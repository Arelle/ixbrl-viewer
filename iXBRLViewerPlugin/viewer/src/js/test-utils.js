// See COPYRIGHT.md for copyright information

import { Inspector } from "./inspector.js";
import { iXBRLViewer } from "./ixbrlviewer";
import { ViewerOptions } from "./viewerOptions";

export function TestInspector() {
    this._iv = new iXBRLViewer({});
    this._viewerOptions = new ViewerOptions();
}

TestInspector.prototype = Object.create(Inspector.prototype);
