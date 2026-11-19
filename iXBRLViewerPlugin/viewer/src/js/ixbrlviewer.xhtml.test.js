/**
 * See COPYRIGHT.md for copyright information
 *
 * @jest-environment jsdom
 * @jest-environment-options {"contentType": "application/xhtml+xml", "html": "<html xmlns='http://www.w3.org/1999/xhtml'><head/><body/></html>"}
 */

import { iXBRLViewer } from "./ixbrlviewer";

test("Adds a viewport meta to the XHTML viewer shell", () => {
    expect(document.contentType).toBe("application/xhtml+xml");
    const viewer = new iXBRLViewer({});

    viewer._addViewportMeta();

    const viewport = document.head.querySelector('meta[name="viewport"]');
    expect(viewport?.getAttribute("content")).toBe("width=device-width, initial-scale=1");
    expect(viewport?.namespaceURI).toBe(document.documentElement.namespaceURI);
});
