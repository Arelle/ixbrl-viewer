// See COPYRIGHT.md for copyright information

// Supply browser APIs that jsdom does not implement.
if (typeof window !== "undefined") {
    // Default to the desktop layout, tests that need the mobile layout replace
    // this with their own mock.
    window.matchMedia = () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
    });

    window.visualViewport = {
        offsetTop: 0,
        offsetLeft: 0,
        width: 1024,
        height: 768,
        addEventListener: () => {},
        removeEventListener: () => {},
    };
}
