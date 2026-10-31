// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import { iXBRLViewer } from "./ixbrlviewer.js";

const scriptSrc = document.currentScript.src;
const inHead = document.currentScript.parentElement === document.head;

// The viewer shows the hidden report itself, once it has moved it into its frame.
document.getElementById("ixv-hide-document")?.setAttribute("data-viewer", "");

const start = () => {
    const options = {
        showValidationWarningOnStart: true,
    };
    const configUrl = new URL("ixbrlviewer.config.json", scriptSrc);
    if (configUrl.protocol != 'file:') {
        options["configUrl"] = configUrl;
    }

    const iv = new iXBRLViewer(options);
    iv.load();
};

// Loaded from the head, the viewer can start as soon as the body has been
// started, and show the report while the rest of it is parsed.
if (inHead && document.body === null) {
    new MutationObserver((records, observer) => {
        if (document.body !== null) {
            observer.disconnect();
            start();
        }
    }).observe(document.documentElement, { childList: true });
}
else {
    $(start);
}
