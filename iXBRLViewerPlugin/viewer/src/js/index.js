// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import { iXBRLViewer } from "./ixbrlviewer.js";

$(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const iv = new iXBRLViewer({
        reviewMode: urlParams.has('review'),
        showValidationWarningOnStart: true
    });
    iv.load();
});
