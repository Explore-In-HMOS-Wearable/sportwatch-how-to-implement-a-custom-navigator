import customRouter from '../../common/customRouter.js';

// Pops back to Detail, optionally returning a value.
export default customRouter.page({
    data: {
        depth: 0,
        message: ''
    },
    onInit(params) {
        this.depth = customRouter.length();
        this.message = params.message;
    },
    save() {
        customRouter.pop({ value: 'Saved!' });
    },
    cancel() {
        customRouter.pop();
    },
    onSwipe(e) {
        if (e.direction === 'right') {
            customRouter.pop();
        }
    }
});
