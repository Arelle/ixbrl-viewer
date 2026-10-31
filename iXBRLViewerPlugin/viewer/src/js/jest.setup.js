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

    // jsdom doesn't lay documents out, so only elements that aren't in a
    // document or are inside display none count as not shown.
    Element.prototype.checkVisibility ??= function () {
        if (!this.isConnected) {
            return false;
        }
        const view = this.ownerDocument.defaultView;
        for (let e = this; e !== null; e = e.parentElement) {
            if (view.getComputedStyle(e).display === "none") {
                return false;
            }
        }
        return true;
    };
}
