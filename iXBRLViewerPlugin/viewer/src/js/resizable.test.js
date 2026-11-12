// See COPYRIGHT.md for copyright information

import { makeResizable } from "./resizable.js";

// jsdom has no PointerEvent, so fake one from a MouseEvent.
function pointerEvent(type, pointerId, clientX = 0, button = 0) {
    const event = new MouseEvent(type, { cancelable: true, clientX, button });
    Object.defineProperty(event, "pointerId", { value: pointerId });
    return event;
}

describe("makeResizable", () => {
    let pane, handle, onStart, onEnd;

    const down = (id, x, button) => handle.dispatchEvent(pointerEvent("pointerdown", id, x, button));
    const move = (id, x) => handle.dispatchEvent(pointerEvent("pointermove", id, x));
    const loseCapture = (id) => handle.dispatchEvent(pointerEvent("lostpointercapture", id));
    // Browsers release capture straight after pointerup.
    const up = (id) => {
        handle.dispatchEvent(pointerEvent("pointerup", id));
        loseCapture(id);
    };

    beforeEach(() => {
        document.body.innerHTML = '<div id="parent"><div id="pane"><div id="handle"></div></div></div>';
        pane = document.getElementById("pane");
        handle = document.getElementById("handle");
        document.getElementById("parent").getBoundingClientRect = () => ({ width: 1000 });
        pane.getBoundingClientRect = () => ({ width: 600 });
        handle.setPointerCapture = jest.fn();
        onStart = jest.fn();
        onEnd = jest.fn();
        makeResizable(pane, handle, { onStart, onEnd });
    });

    test("Dragging sets the width as a percentage of the parent", () => {
        down(1, 600);
        expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
        move(1, 400);
        expect(onStart).toHaveBeenCalledTimes(1);
        expect(pane.style.width).toBe("40%");
        expect(pane.style.flexGrow).toBe("0");
        expect(document.documentElement.style.cursor).toBe("ew-resize");
        up(1);
        expect(onEnd).toHaveBeenCalledTimes(1);
        expect(document.documentElement.style.cursor).toBe("");
    });

    test("Width is clamped to the parent and a minimum", () => {
        down(1, 600);
        move(1, -1000);
        expect(pane.style.width).toBe("10%");
        move(1, 2000);
        expect(pane.style.width).toBe("100%");
    });

    test("Moves after the drag has ended are ignored", () => {
        down(1, 600);
        move(1, 400);
        up(1);
        move(1, 300);
        expect(pane.style.width).toBe("40%");
    });

    test("A second pointer does not interrupt the active drag", () => {
        down(1, 600);
        move(1, 500);
        down(2, 600);
        up(2);
        move(1, 400);
        expect(pane.style.width).toBe("40%");
        expect(handle.setPointerCapture).toHaveBeenCalledTimes(1);
        expect(onStart).toHaveBeenCalledTimes(1);
        expect(onEnd).not.toHaveBeenCalled();
        up(1);
        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    test("Losing capture without a pointerup ends the drag", () => {
        down(1, 600);
        move(1, 400);
        loseCapture(1);
        expect(onEnd).toHaveBeenCalledTimes(1);
        move(1, 300);
        expect(pane.style.width).toBe("40%");
        down(2, 600);
        move(2, 500);
        expect(onStart).toHaveBeenCalledTimes(2);
    });

    test("A click without movement leaves the layout alone", () => {
        down(1, 600);
        up(1);
        expect(onStart).not.toHaveBeenCalled();
        expect(onEnd).not.toHaveBeenCalled();
        expect(pane.style.width).toBe("");
        expect(pane.style.flexGrow).toBe("");
    });

    test("Buttons other than the primary are ignored", () => {
        down(1, 600, 2);
        move(1, 400);
        expect(handle.setPointerCapture).not.toHaveBeenCalled();
        expect(onStart).not.toHaveBeenCalled();
        expect(pane.style.width).toBe("");
    });
});
