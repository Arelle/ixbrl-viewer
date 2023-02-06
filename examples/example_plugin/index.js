import $ from 'jquery'
import {iXBRLViewer} from "ixbrl-viewer"
import {ExtendedViewer} from "./extended-viewer.js";

$(function () {
    var iv = new iXBRLViewer();
    var ivp = new ExtendedViewer(iv);
    iv.registerPlugin(ivp);
    iv.load();
});
