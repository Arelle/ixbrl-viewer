# Copyright 2019 Workiva Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# GUI operation:
#
#     if submenu View->iXBRL Viewer->Show iXBRL Filing Data is checkmarked, a local viewer is automatically opened to view
#
#     to save a viewable file Tools->Save iXBRL Viewer Instance (dialog requests linkable js location and save location)
#
# Command line operation:
#
#     parameters --save-viewer (file system location to save at) and --viewer-url (linkable js location)
#
# Web Server operation:
#
#     example uploading an ESEF report package and receiving a zip of viewable .xhtml and viewer javascript file:
#
#         curl -X POST "-HContent-type: application/zip" 
#              -T /Users/mystuff/ESMA/samples/bzwbk_2016.zip 
#              -o ~/temp/out.zip 
#              "http://localhost:8080/rest/xbrl/validation?&media=zip&plugins=iXBRLViewerPlugin&packages=somewhere/esef_taxonomy_2017.zip"
#


from .iXBRLViewer import IXBRLViewerBuilder
import os, zipfile, sys, traceback
from arelle.FileSource import archiveFilenameParts

BUILTIN_SCRIPT_URL = os.path.join(os.path.dirname(__file__), "viewer", "dist", "ixbrlviewer.js")

def iXBRLViewerCommandLineOptionExtender(parser, *args, **kwargs):
    parser.add_option("--save-viewer",
                      action="store",
                      dest="saveViewerFile",
                      help="Save an HTML viewer file for an iXBRL report. Specify either a filename or directory.")
    parser.add_option("--viewer-url",
                      action="store",
                      dest="viewerURL",
                      # default="js/dist/ixbrlviewer.js",
                      help="Specify the URL to ixbrlviewer.js")


def iXBRLViewerCommandLineXbrlRun(cntlr, options, *args, **kwargs):
    # extend XBRL-loaded run processing for this option
    if cntlr.modelManager is None or cntlr.modelManager.modelXbrl is None:
        cntlr.addToLog("No taxonomy loaded.")
        return
    try:
        modelXbrl = cntlr.modelManager.modelXbrl
        responseZipStream = kwargs.get("responseZipStream")
        responseZip = None
        out = getattr(options, 'saveViewerFile', False)
        if not out and responseZipStream:
            out = modelXbrl.modelDocument.basename.rpartition(".")[0] + "-ixbrlView.html"
        if out:
            viewerBuilder = IXBRLViewerBuilder(modelXbrl)
            if options.viewerURL: 
                scriptUrl = options.viewerURL
            else: # default viewer js file
                scriptUrl = "ixbrlviewer.js" # serve by LocalViewer or include in zip file
            iv = viewerBuilder.createViewer(scriptUrl=scriptUrl)
            if responseZipStream:
                responseZip = zipfile.ZipFile(responseZipStream, "w", zipfile.ZIP_DEFLATED, True)
            iv.save(out, responseZip=responseZip)
            if responseZip and scriptUrl == "ixbrlviewer.js":
                responseZip.write(BUILTIN_SCRIPT_URL, scriptUrl)
            if responseZip:
                responseZip.close()
    except Exception as ex:
        print("Exception {} \nTraceback {}".format(ex, traceback.format_tb(sys.exc_info()[2])))
        cntlr.addToLog("Exception {} \nTraceback {}".format(ex, traceback.format_tb(sys.exc_info()[2])))


def iXBRLViewerMenuCommand(cntlr):
    from .ui import SaveViewerDialog
    if cntlr.modelManager is None or cntlr.modelManager.modelXbrl is None:
        cntlr.addToLog("No document loaded.")
        return
    dialog = SaveViewerDialog(cntlr)
    if dialog.accepted and dialog.filename():
        viewerBuilder = IXBRLViewerBuilder(cntlr.modelManager.modelXbrl)
        iv = viewerBuilder.createViewer(scriptUrl=dialog.scriptUrl())
        iv.save(dialog.filename())


def iXBRLViewerMenuExtender(cntlr, menu, *args, **kwargs):
    # Extend menu with an item for the savedts plugin
    menu.add_command(label="Save iXBRL Viewer Instance",
                     underline=0,
                     command=lambda: iXBRLViewerMenuCommand(cntlr))


def menuExtender(cntlr, menu, *args, **kwargs):
    iXBRLViewerMenuExtender(cntlr, menu, *args, **kwargs)


def commandLineOptionExtender(*args, **kwargs):
    iXBRLViewerCommandLineOptionExtender(*args, **kwargs)


def commandLineRun(*args, **kwargs):
    iXBRLViewerCommandLineXbrlRun(*args, **kwargs)

def guiViewMenuExtender(cntlr, viewMenu, *args, **kwargs):
    # persist menu selections for showing filing data and tables menu
    from tkinter import Menu, BooleanVar # must only import if GUI present (no tkinter on GUI-less servers)
    def setShowFilingData(self, *args):
        cntlr.config["iXBRLViewerShowFilingData"] = cntlr.showiXBRLFilingData.get()
        cntlr.saveConfig()
    erViewMenu = Menu(cntlr.menubar, tearoff=0)
    viewMenu.add_cascade(label=_("iXBRL Viewer"), menu=erViewMenu, underline=0)
    cntlr.showiXBRLFilingData = BooleanVar(value=cntlr.config.get("iXBRLViewerShowFilingData", True))
    cntlr.showiXBRLFilingData.trace("w", setShowFilingData)
    erViewMenu.add_checkbutton(label=_("Show iXBRL Filing Data"), underline=0, variable=cntlr.showiXBRLFilingData, onvalue=True, offvalue=False)

def guiRun(cntlr, modelXbrl, attach, *args, **kwargs):
    """ run iXBRL Viewer using GUI interactions for a single instance or testcases """
    if cntlr.hasGui and cntlr.showiXBRLFilingData.get():
        from . import LocalViewer
        try:
            viewerBuilder = IXBRLViewerBuilder(cntlr.modelManager.modelXbrl)
            iv = viewerBuilder.createViewer(scriptUrl="ixbrlviewer.js")
            # first check if source file was in an archive (e.g., taxonomy package)
            _archiveFilenameParts = archiveFilenameParts(modelXbrl.modelDocument.filepath)
            if _archiveFilenameParts is not None:
                outDir = os.path.dirname(_archiveFilenameParts[0]) # it's a zip or package
            else: 
                outDir = modelXbrl.modelDocument.filepathdir
            out = modelXbrl.modelDocument.basename.rpartition(".")[0] + "-ixbrlView.html"
            iv.save(out, outDir=outDir)
            _localhost = LocalViewer.init(cntlr, outDir)
            import webbrowser
            webbrowser.open(url="{}/{}".format(_localhost, out))
        except Exception as ex:
            modelXbrl.error("viewer:exception",
                            "Exception %(exception)s \sTraceback %(traceback)s",
                            modelObject=modelXbrl, exception=ex, traceback=traceback.format_tb(sys.exc_info()[2]))

__pluginInfo__ = {
    'name': 'ixbrl-viewer',
    'version': '0.1',
    'description': "iXBRL Viewer creator",
    'license': 'License :: OSI Approved :: Apache License, Version 2.0 (Apache-2.0)',
    'author': 'Paul Warren',
    'copyright': 'Copyright :: Workiva Inc. :: 2019',
    #'imports': ["./iXBRLViewer.py"],
    'CntlrCmdLine.Options': commandLineOptionExtender,
    'CntlrCmdLine.Xbrl.Run': commandLineRun,
    'CntlrWinMain.Menu.Tools': menuExtender,
    # GUI operation, add View -> iXBRLViewer submenu for GUI options
    'CntlrWinMain.Menu.View': guiViewMenuExtender,
    # GUI operation startup (starts up viewer)
    'CntlrWinMain.Xbrl.Loaded': guiRun,
}
