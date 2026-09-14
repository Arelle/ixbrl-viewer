// See COPYRIGHT.md for copyright information

// Browser APIs that jsdom does not implement. The puppeteer suite shares this
// config but runs in the node environment, where there is no window.
if (typeof window !== "undefined") {
    // Default to the desktop layout, tests that need the mobile layout replace
    // this with their own mock.
    window.matchMedia = () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
    });
}
