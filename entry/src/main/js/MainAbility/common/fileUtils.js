import file from '@system.file';

// --- Writable app-data files (read/write) ------------------------------------
const APP_DIR = 'internal://app/';

// Overwrite `name` in the app's data dir with `text`. Returns true on success.
function writeAppText(name, text) {
    let done = false;
    let ok = false;
    file.writeText({
        uri: APP_DIR + name,
        text: text,
        success: function () {
            ok = true;
            done = true;
        },
        fail: function (data, code) {
            console.error(`writeAppText fail: ${name} code=${code}`);
            done = true;
        }
    });
    while (!done) { }
    return ok;
}

// Read `name` from the app's data dir, in chunks. Returns '' if it is missing.
function readAppText(name) {
    let content = '';
    let finished = false;
    let idx = 0;
    const chunkSize = 4000;
    while (!finished) {
        file.readText({
            uri: APP_DIR + name,
            length: chunkSize,
            position: chunkSize * idx,
            success: function (data) {
                idx++;
                content = content + data.text;
                if (data.text.length < chunkSize) {
                    finished = true;
                }
            },
            fail: function (data, code) {
                finished = true;
            }
        });
    }
    return content;
}

export default {
    writeAppText: writeAppText,
    readAppText: readAppText
};
