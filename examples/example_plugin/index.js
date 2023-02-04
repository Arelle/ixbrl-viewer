import $ from 'jquery'
import {iXBRLViewer} from "ixbrl-viewer"
import {ExtendedVeiwer} from "./extended-veiwer.js";

$(function () {
    var iv = new iXBRLViewer();
    var ivp = new ExtendedVeiwer(iv);
    iv.registerPlugin(ivp);
    iv.load();
});
