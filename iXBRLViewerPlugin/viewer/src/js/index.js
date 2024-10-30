// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import { iXBRLViewer } from "./ixbrlviewer.js";

const scriptSrc = document.currentScript.src;

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
