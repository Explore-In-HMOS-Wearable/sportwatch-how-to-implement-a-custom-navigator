import customRouter from '../../common/customRouter.js';

// The hub screen. Shows the pushed message and demonstrates
// push, pushReplace and pop — plus any value the Editor returns.
export default customRouter.page({
    data: {
        depth: 0,
        message: '',
        returned: ''
    },
    onInit(params, result) {
        this.depth = customRouter.length();
        this.message = params.message;
        if (result) {
            this.returned = result.value;
        }
    },
    openEditor() {
        customRouter.push('pages/editor/editor', { message: this.message });
    },
    replaceSelf() {
        customRouter.pushReplace('pages/detail/detail', { message: 'Replaced!' });
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
