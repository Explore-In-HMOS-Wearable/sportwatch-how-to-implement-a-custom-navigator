import customRouter from '../../common/customRouter.js';

// Home — pushes Detail and passes it a message.
export default customRouter.page({
    data: {
        depth: 1
    },
    onInit() {
        this.depth = customRouter.length();
    },
    openDetail() {
        customRouter.push('pages/detail/detail', { message: 'Hello from Home' });
    },
    openLoadTest() {
        customRouter.push('pages/loadtest/loadtest', { n: 1, payload: 'start' });
    }
});
