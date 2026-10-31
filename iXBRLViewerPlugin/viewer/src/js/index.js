// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import { iXBRLViewer } from "./ixbrlviewer.js";

const scriptSrc = document.currentScript.src;

// The viewer shows the hidden report itself, once it has moved it into its frame.
document.getElementById("ixv-hide-document")?.setAttribute("data-viewer", "");

$(() => {
    const options = {
        showValidationWarningOnStart: true,
    };
    const configUrl = new URL("ixbrlviewer.config.json", scriptSrc);
    if (configUrl.protocol != 'file:') {
        options["configUrl"] = configUrl;
    }

    const iv = new iXBRLViewer(options);
    iv.load();
});
