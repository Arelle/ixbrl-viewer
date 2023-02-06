import {iXBRLViewer} from "ixbrl-viewer"
import {ExtendedViewer} from "./extended-viewer.js";

document.addEventListener("DOMContentLoaded", () =>  {
    const iv = new iXBRLViewer(); // prefer const then let
    const ivp = new ExtendedViewer(iv);
    iv.registerPlugin(ivp);
    iv.load();
});
