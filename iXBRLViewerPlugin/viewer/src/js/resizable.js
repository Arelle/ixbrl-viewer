// See COPYRIGHT.md for copyright information

const MIN_WIDTH = 100;

/*
 * Lets the user drag `handle` to resize the width of `pane`.  The width is
 * stored as a percentage of the parent so that the split survives window
 * resizes.
 */
export function makeResizable(pane, handle, { onStart, onEnd } = {}) {
    const root = handle.ownerDocument.documentElement;
    let drag = null;

    const setWidth = (width) => {
        const parentWidth = pane.parentElement.getBoundingClientRect().width;
        const clamped = Math.min(parentWidth, Math.max(MIN_WIDTH, width));
        pane.style.width = `${100 * clamped / parentWidth}%`;
    };

    handle.addEventListener('pointerdown', (e) => {
        if (drag !== null || e.button !== 0) {
            return;
        }
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        drag = { pointerId: e.pointerId, startX: e.clientX, startWidth: pane.getBoundingClientRect().width, started: false };
    });

    handle.addEventListener('pointermove', (e) => {
        if (drag?.pointerId !== e.pointerId) {
            return;
        }
        // Wait for movement so that a plain click leaves the flex layout alone.
        if (!drag.started) {
            drag.started = true;
            pane.style.flexGrow = 0;
            // The pointer can leave the handle mid drag, so show the cursor everywhere.
            root.style.cursor = 'ew-resize';
            onStart?.();
        }
        setWidth(drag.startWidth + e.clientX - drag.startX);
    });

    // Capture is released after pointerup and pointercancel, but can also be
    // lost without either, so this is the only reliable end of a drag.
    handle.addEventListener('lostpointercapture', (e) => {
        if (drag?.pointerId !== e.pointerId) {
            return;
        }
        if (drag.started) {
            root.style.cursor = '';
            onEnd?.();
        }
        drag = null;
    });
}
