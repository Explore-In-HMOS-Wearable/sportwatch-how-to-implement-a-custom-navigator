import router from '@system.router';
import fileUtils from './fileUtils.js';

// Entry page; attach() seeds the stack here and pop() returns to it.
const ROOT_URI = 'pages/index/index';

// Reserved param keys that carry the stack + a pop result between pages.
const STACK_KEY = '__navStack';
const RESULT_KEY = '__navResult';

// Where the stack lives:
//   false - the whole stack rides in each page's params (simple; the default).
//   true  - one small file per entry (navstack_0.json, navstack_1.json, ...).
const USE_FILE_STACK = false;
const STACK_PREFIX = 'navstack_';

// Set by a navigation so a double-tap can't fire twice; attach() clears it on the next page.
let navigating = false;

// One-shot value handed to this page by a pop(); read via getResult().
let pendingResult;

/**
 * Normalize navigation arguments into a { uri, params } route.
 * @param {string|Object} target - A uri string, or a { uri, params } object.
 * @param {Object} [params] - Params, used when target is a uri string.
 * @returns {{uri: string, params: Object}}
 */
function normalize(target, params) {
    if (typeof target === 'string') {
        return { uri: target, params: params || {} };
    }
    target = target || {};
    return { uri: target.uri, params: target.params || params || {} };
}

/**
 * Parse a serialized stack, or null if it is empty/invalid.
 * @param {string} raw - The JSON string from the incoming params.
 * @returns {Array|null}
 */
function parseStack(raw) {
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.length) {
            return parsed;
        }
    } catch (e) {
        // ignore
    }
    return null;
}

// ---------------------------------------------------------------------------
// Stores
//
// A store decides WHERE the navigation stack is kept. Both expose the same small
// interface, so the public API below never has to care about the mode. An entry
// is { uri, params }; the last entry is the page on screen.
//   load(vm)          rebuild state from the page's incoming params
//   depth()           how many entries
//   top()             the current entry
//   append(entry)     push a new entry on top
//   replaceTop(entry) swap the current entry (pushReplace)
//   dropTop()         remove the current entry (pop)
//   resetTo(entry)    collapse to a single entry
//   encode()          the params object that carries the stack to the next page
//   byteSize()        diagnostic: bytes moved per hop
// ---------------------------------------------------------------------------

// Param store: the whole stack rides in the page params, rebuilt on every hop.
let stack = [];

const paramStore = {
    load(vm) {
        const incoming = vm ? vm[STACK_KEY] : '';
        stack = parseStack(incoming) || [{ uri: ROOT_URI, params: {} }];
    },
    depth() {
        return stack.length;
    },
    top() {
        return stack[stack.length - 1] || { uri: ROOT_URI, params: {} };
    },
    append(entry) {
        stack = stack.concat([entry]);
    },
    replaceTop(entry) {
        if (stack.length) {
            stack[stack.length - 1] = entry;
        } else {
            stack.push(entry);
        }
    },
    dropTop() {
        stack = stack.slice(0, stack.length - 1);
    },
    resetTo(entry) {
        stack = [entry];
    },
    encode() {
        const params = {};
        params[STACK_KEY] = JSON.stringify(stack);
        return params;
    },
    byteSize() {
        return JSON.stringify(stack).length;
    }
};

// File store: one file per entry. Only the depth travels
// in params. append/replaceTop write one file and pop reads one file, so nothing
// scans the whole stack. Popped files stay on disk and are overwritten by the
// next push.
let fileDepth = 0;
let fileTop = null;

function entryFile(index) {
    return `${STACK_PREFIX + index}.json`;
}

function writeEntry(index, entry) {
    fileUtils.writeAppText(entryFile(index), JSON.stringify(entry));
}

function readEntry(index) {
    try {
        return JSON.parse(fileUtils.readAppText(entryFile(index)));
    } catch (e) {
        return null;
    }
}

const fileStore = {
    load(vm) {
        const marker = vm ? vm[STACK_KEY] : '';
        if (!marker) {
            // Cold start: root is the only entry. Persist it so a later pop back
            // to the root can read it.
            fileDepth = 1;
            fileTop = { uri: ROOT_URI, params: {} };
            writeEntry(0, fileTop);
        } else {
            fileDepth = parseInt(marker, 10) || 1;
            fileTop = readEntry(fileDepth - 1) || { uri: ROOT_URI, params: {} };
        }
    },
    depth() {
        return fileDepth;
    },
    top() {
        return fileTop || { uri: ROOT_URI, params: {} };
    },
    append(entry) {
        writeEntry(fileDepth, entry);   // the new entry's index is the current depth
        fileDepth = fileDepth + 1;
        fileTop = entry;
    },
    replaceTop(entry) {
        writeEntry(fileDepth - 1, entry);
        fileTop = entry;
    },
    dropTop() {
        fileDepth = fileDepth - 1;
        fileTop = readEntry(fileDepth - 1) || { uri: ROOT_URI, params: {} };
    },
    resetTo(entry) {
        writeEntry(0, entry);
        fileDepth = 1;
        fileTop = entry;
    },
    encode() {
        const params = {};
        params[STACK_KEY] = String(fileDepth);
        return params;
    },
    byteSize() {
        return JSON.stringify(fileTop).length;
    }
};

// Picked once for the whole app; every page uses the same mode.
const store = USE_FILE_STACK ? fileStore : paramStore;

/**
 * Rebuild navigation state from the page's incoming params. Called first in
 * onInit (page() does this for you).
 * @param {Object} vm - The page instance (`this`).
 */
function attach(vm) {
    navigating = false;
    store.load(vm);

    pendingResult = undefined;
    if (vm && vm[RESULT_KEY]) {
        try {
            pendingResult = JSON.parse(vm[RESULT_KEY]);
        } catch (e) {
            pendingResult = undefined;
        }
    }
}

// Carry the store's encoded stack (+ optional result) in the params and hop.
function commit(uri, result) {
    navigating = true;
    const params = store.encode();
    if (result !== undefined) {
        params[RESULT_KEY] = JSON.stringify(result);
    }
    router.replace({ uri: uri, params: params });
}

/**
 * Push a new page on top of the stack and navigate to it.
 * @param {string|Object} target - Destination uri, or { uri, params }.
 * @param {Object} [params] - Params for the destination page.
 * @returns {boolean} True if navigation started.
 */
function push(target, params) {
    if (navigating) {
        return false;
    }
    const route = normalize(target, params);
    if (!route.uri) {
        return false;
    }
    store.append({ uri: route.uri, params: route.params });
    commit(route.uri, undefined);
    return true;
}

/**
 * Replace the current page with a new one (not kept in history, so pop skips it).
 * @param {string|Object} target - Destination uri, or { uri, params }.
 * @param {Object} [params] - Params for the destination page.
 * @returns {boolean} True if navigation started.
 */
function pushReplace(target, params) {
    if (navigating) {
        return false;
    }
    const route = normalize(target, params);
    if (!route.uri) {
        return false;
    }
    store.replaceTop({ uri: route.uri, params: route.params });
    commit(route.uri, undefined);
    return true;
}

/**
 * Go back to the previous page, optionally returning a value to it.
 * @param {*} [result] - Value the revealed page reads via getResult().
 * @returns {boolean} False if already at the root (nothing to pop).
 */
function pop(result) {
    if (navigating) {
        return false;
    }
    if (store.depth() <= 1) {
        return false;
    }
    store.dropTop();
    commit(store.top().uri, result);
    return true;
}

/**
 * Params for the page currently on screen.
 * @returns {Object} Always an object (never null).
 */
function getParams() {
    return store.top().params || {};
}

/**
 * Read and clear any value handed to this page by a pop().
 * @returns {*} The value, or undefined if none.
 */
function getResult() {
    const result = pendingResult;
    pendingResult = undefined;
    return result;
}

// ---- helpers (optional, handy for building UI) ----

/** @returns {number} Number of pages in the stack. */
function length() {
    return store.depth();
}

/** @returns {number} Bytes moved per hop (whole stack in param mode, one entry in file mode). */
function stackSize() {
    return store.byteSize();
}

/** @returns {boolean} True if there is a page to pop back to. */
function canPop() {
    return store.depth() > 1;
}

/**
 * Clear all history and navigate to a fresh root.
 * @param {string|Object} target - New root uri, or { uri, params }.
 * @param {Object} [params] - Params for the new root.
 * @returns {boolean} True if navigation started.
 */
function reset(target, params) {
    if (navigating) {
        return false;
    }
    const route = normalize(target, params || {});
    const uri = route.uri || ROOT_URI;
    store.resetTo({ uri: uri, params: route.params });
    commit(uri, undefined);
    return true;
}

/**
 * Wrap a page's export so navigation plumbing is automatic: injects the reserved
 * transport keys into `data`, rebuilds the stack on load, and passes
 * (params, result) to your onInit. Use as `export default customRouter.page({...})`.
 * @param {Object} config - Your normal page definition (data, onInit, methods).
 * @returns {Object} The prepared page definition.
 */
function page(config) {
    config = config || {};

    // A page's `data` can be written two ways in the lite JS framework: as a
    // plain object (`data: { ... }`) or as a factory function that returns a
    // fresh object (`data() { return { ... }; }`, like Vue's data function).
    // Either form must gain the reserved transport keys so the router's params
    // reach the page, so for the function form we wrap it: run the original,
    // then add the keys to the object it returns.
    let data = config.data;
    if (typeof data === 'function') {
        config.data = function () {
            const d = data.call(this) || {};
            if (d[STACK_KEY] === undefined) { d[STACK_KEY] = ''; }
            if (d[RESULT_KEY] === undefined) { d[RESULT_KEY] = ''; }
            return d;
        };
    } else {
        data = data || {};
        if (data[STACK_KEY] === undefined) { data[STACK_KEY] = ''; }
        if (data[RESULT_KEY] === undefined) { data[RESULT_KEY] = ''; }
        config.data = data;
    }

    const originalOnInit = config.onInit;
    config.onInit = function () {
        attach(this);
        if (originalOnInit) {
            originalOnInit.call(this, getParams(), getResult());
        }
    };

    return config;
}

export default {
    page: page,
    push: push,
    pushReplace: pushReplace,
    pop: pop,
    length: length,
    stackSize: stackSize,
    canPop: canPop,
    reset: reset
};
