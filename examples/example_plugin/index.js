import {iXBRLViewer} from "ixbrl-viewer"
import {ExtendedViewer} from "./extended-viewer.js";


const loadPlugin = () => {
    const iv = new iXBRLViewer(); // prefer const then let
    const ivp = new ExtendedViewer(iv);
    iv.registerPlugin(ivp);
    iv.load();
}

if (document.readyState === 'loading') {  // Loading hasn't finished yet
    document.addEventListener("DOMContentLoaded", loadPlugin);
} else {
    loadPlugin();
}
