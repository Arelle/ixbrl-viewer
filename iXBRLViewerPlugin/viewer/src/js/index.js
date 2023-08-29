// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import { iXBRLViewer } from "./ixbrlviewer.js";

$(() => {
    const iv = new iXBRLViewer({
        showValidationWarningOnStart: true
    });
    iv.load();
});
