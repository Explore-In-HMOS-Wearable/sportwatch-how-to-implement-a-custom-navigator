import customRouter from '../../common/customRouter.js';

// Load test: each tap pushes ANOTHER copy of this page (carrying params) on top
// of the stack — a real push, not pushReplace. Watch how deep the stack goes
// before the growing param blob (the whole nav stack) gets too big to pass.
export default customRouter.page({
    data: {
        depth: 0,
        n: 0,
        stackLen: 0
    },
    onInit(params) {
        this.depth = customRouter.length();
        this.n = params.n || 0;
        this.stackLen = customRouter.stackSize();
    },
    pushAnother() {
        const next = this.n + 1;
        customRouter.push('pages/loadtest/loadtest', {
            n: next,
            payload: makePayload(next)
        });
    },
    goBack() {
        customRouter.pop();
    },
    onSwipe(e) {
        if (e.direction === 'right') {
            customRouter.pop();
        }
    }
});

// Some parameter data so each page adds real weight to the stack (~100 chars).
function makePayload(n) {
    return (`p${n}-`).repeat(25);
}
