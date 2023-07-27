# See COPYRIGHT.md for copyright information
from __future__ import annotations

import argparse
import io
import logging
import os
import sys
import tempfile
import traceback
from optparse import OptionGroup, OptionParser
from typing import Optional, Union

from arelle import Cntlr
from arelle.LocalViewer import LocalViewer
from arelle.ModelDocument import Type
from arelle.webserver.bottle import static_file

from iXBRLViewerPlugin.constants import DEFAULT_VIEWER_PATH
from .iXBRLViewer import IXBRLViewerBuilder, IXBRLViewerBuilderError, VIEWER_FEATURES_AND_DESCRIPTIONS


#
# GUI operation:
#
#     if submenu View->iXBRL Viewer->Launch viewer on load is checkmarked, a local viewer is automatically opened to view
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
#     In the zip, the iXBRLViewer files are in a subdirectory VIEWER_BASENAME_SUFFIX to separate them from possible EdgarRenderer and other output files
#


def iXBRLViewerCommandLineOptionExtender(parser, *args, **kwargs):
    parser.add_option("--save-viewer",
                      action="store",
                      dest="saveViewerDest",
                      help="Save an HTML viewer file for an iXBRL report. Specify either a filename or directory.")
    parser.add_option("--viewer-url",
                      action="store",
                      dest="viewerURL",
                      default=DEFAULT_VIEWER_PATH,
                      help="Specify the URL to ixbrlviewer.js")
    parser.add_option("--viewer-validation-messages",
                      dest="validationMessages",
                      action="store_true",
                      help="Include validation messages in the viewer")
    # Force logging to use a buffer so that messages are retained and can be
    # retrieved for inclusion with the viewer.
    parser.add_option("--logToBuffer", action="store_true", dest="logToBuffer", default=True, help=argparse.SUPPRESS)
    parser.add_option("--use-stub-viewer",
                      action="store_true",
                      dest="useStubViewer",
                      help="Use stub viewer for faster loading of inspector (requires web server)")
    parser.add_option("--viewer-suffix",
                      action="store",
                      default="",
                      dest="viewerBasenameSuffix",
                      help="Suffix for basename of viewer files")
    parser.add_option("--package-download-url",
                      action="store",
                      dest="packageDownloadURL",
                      help="URL where the original report package can be downloaded.  This will be available to the user as a download link in the viewer.")
    parser.add_option("--zip-viewer-output",
                      action="store_true",
                      default=False,
                      dest="zipViewerOutput",
                      help="Converts the viewer output into a self contained zip")
    featureGroup = OptionGroup(parser, "Viewer Features",
                            "See viewer README for information on enabling/disabling features.")
    for featureName, featureDescription in VIEWER_FEATURES_AND_DESCRIPTIONS.items():
        arg = f'--viewer-feature-{featureName}'
        featureGroup.add_option(arg, arg.lower(), action="store_true", default=False, help=featureDescription)
    parser.add_option_group(featureGroup)


def generateViewer(
        cntlr: Cntlr,
        saveViewerDest: Union[io.BytesIO, str],
        viewerURL: str = DEFAULT_VIEWER_PATH,
        showValidationMessages: bool = False,
        useStubViewer: bool = False,
        zipViewerOutput: bool = False,
        features: Optional[list[str]] = None,
        packageDownloadURL: str = None):
    """
    Generate and save a viewer at the given destination (file, directory, or in-memory file) with the given viewer URL.
    If the viewer URL is a location on the local file system, a copy will be placed included in the output destination.
    :param cntlr: The arelle controller that contains the model to be included in the viewer
    :param saveViewerDest: The target that viewer data/files will be written to (path to file or directory, or a file object itself).
    :param viewerURL: The filepath or URL location of the viewer script.
    :param showValidationMessages: True if validation messages should be shown in the viewer.
    :param useStubViewer: True if the stub viewer should be used.
    :param zipViewerOutput: True if the destination is a zip archive.
    :param features: List of feature names to enable via generated JSON data.
    """
    # extend XBRL-loaded run processing for this option
    if cntlr.modelManager is None or cntlr.modelManager.modelXbrl is None or not cntlr.modelManager.modelXbrl.modelDocument:
        cntlr.addToLog("No taxonomy loaded.")
        return
    modelXbrl = cntlr.modelManager.modelXbrl
    if modelXbrl.modelDocument.type not in (Type.INLINEXBRL, Type.INLINEXBRLDOCUMENTSET):
        cntlr.addToLog("No inline XBRL document loaded.")
        return
    copyScriptPath = None
    if isinstance(saveViewerDest, str):
        # Note on URLs: Rather than rely on logic to determine if the input is a file
        # path or web address, we can allow web addresses to be considered relative paths.
        # Unless the URL happens to resolve to an existing file on the local filesystem,
        # it will skip this step and pass through into the viewer as expected.
        if os.path.isabs(viewerURL):
            viewerAbsolutePath = viewerURL
        else:
            viewerAbsolutePath = getAbsoluteViewerPath(saveViewerDest, viewerURL)

        if os.path.isfile(viewerAbsolutePath):
            # The script was found on the local file system and will be copied into the
            # destination directory, so the local path (just the basename) of viewerURL should
            # be passed to the script tag
            copyScriptPath = viewerURL
            viewerURL = os.path.basename(viewerURL)
    try:
        out = saveViewerDest
        if out:
            viewerBuilder = IXBRLViewerBuilder(modelXbrl)
            if features:
                for feature in features:
                    viewerBuilder.enableFeature(feature)
            iv = viewerBuilder.createViewer(scriptUrl=viewerURL, showValidations=showValidationMessages, useStubViewer=useStubViewer, packageDownloadURL=packageDownloadURL)
            if iv is not None:
                iv.save(out, zipOutput=zipViewerOutput, copyScriptPath=copyScriptPath)
    except IXBRLViewerBuilderError as ex:
        print(ex.message)
    except Exception as ex:
        cntlr.addToLog("Exception {} \nTraceback {}".format(ex, traceback.format_tb(sys.exc_info()[2])))


def getAbsoluteViewerPath(saveViewerPath: str, relativeViewerPath: str) -> str:
    """
    Generate a path to the viewer script given the save destination path as a starting point.
    :param saveViewerPath: Path to file or directory where viewer output will be saved.
    :param relativeViewerPath: Path to save destination relative to viewer save path.
    :return: An absolute file path to the viewer.
    """
    saveViewerDir = saveViewerPath
    if os.path.isfile(saveViewerDir):
        saveViewerDir = os.path.dirname(os.path.join(os.getcwd(), saveViewerDir))
    return os.path.join(saveViewerDir, relativeViewerPath)


def getFeaturesFromOptions(options: Union[argparse.Namespace, OptionParser]):
    return [
        featureName
        for featureName in VIEWER_FEATURES_AND_DESCRIPTIONS.keys()
        if getattr(options, f'viewer_feature_{featureName}') or getattr(options, f'viewer_feature_{featureName.lower()}')
    ]


def iXBRLViewerCommandLineXbrlRun(cntlr, options, *args, **kwargs):
    generateViewer(
        cntlr,
        options.saveViewerDest or kwargs.get("responseZipStream"),
        options.viewerURL,
        options.validationMessages,
        options.useStubViewer,
        options.zipViewerOutput,
        getFeaturesFromOptions(options),
        options.packageDownloadURL,
    )


def iXBRLViewerMenuCommand(cntlr):
    from .ui import SaveViewerDialog
    if cntlr.modelManager is None or cntlr.modelManager.modelXbrl is None:
        cntlr.addToLog("No document loaded.")
        return
    modelXbrl = cntlr.modelManager.modelXbrl
    if modelXbrl.modelDocument.type not in (Type.INLINEXBRL, Type.INLINEXBRLDOCUMENTSET):
        cntlr.addToLog("No inline XBRL document loaded.")
        return
    dialog = SaveViewerDialog(cntlr)
    if dialog.accepted and dialog.filename():
        generateViewer(
            cntlr,
            dialog.filename(),
            dialog.scriptUrl(),
            zipViewerOutput=dialog.zipViewerOutput(),
        )


def iXBRLViewerToolsMenuExtender(cntlr, menu, *args, **kwargs):
    # Extend menu with an item for the savedts plugin
    menu.add_command(label="Save iXBRL Viewer Instance",
                     underline=0,
                     command=lambda: iXBRLViewerMenuCommand(cntlr))


def toolsMenuExtender(cntlr, menu, *args, **kwargs):
    iXBRLViewerToolsMenuExtender(cntlr, menu, *args, **kwargs)


def commandLineOptionExtender(*args, **kwargs):
    iXBRLViewerCommandLineOptionExtender(*args, **kwargs)


def commandLineRun(*args, **kwargs):
    iXBRLViewerCommandLineXbrlRun(*args, **kwargs)


def viewMenuExtender(cntlr, viewMenu, *args, **kwargs):
    # persist menu selections for showing filing data and tables menu
    from tkinter import Menu, BooleanVar  # must only import if GUI present (no tkinter on GUI-less servers)
    def setLaunchIXBRLViewer(self, *args):
        cntlr.config["LaunchIXBRLViewer"] = cntlr.launchIXBRLViewer.get()
        cntlr.saveConfig()
    erViewMenu = Menu(cntlr.menubar, tearoff=0)
    viewMenu.add_cascade(label=_("iXBRL Viewer"), menu=erViewMenu, underline=0)
    cntlr.launchIXBRLViewer = BooleanVar(value=cntlr.config.get("LaunchIXBRLViewer", True))
    cntlr.launchIXBRLViewer.trace("w", setLaunchIXBRLViewer)
    erViewMenu.add_checkbutton(label=_("Launch viewer on load"), underline=0, variable=cntlr.launchIXBRLViewer, onvalue=True, offvalue=False)


class iXBRLViewerLocalViewer(LocalViewer):
    # plugin-specific local file handler
    def getLocalFile(self, file, relpath, request):
        _report, _sep, _file = file.partition("/")
        if file == 'ixbrlviewer.js':
            return static_file('ixbrlviewer.js', os.path.dirname(DEFAULT_VIEWER_PATH))
        elif _report.isnumeric():  # in reportsFolder folder
            # check if file is in the current or parent directory
            _fileDir = self.reportsFolders[int(_report)]
            _fileExists = False
            if os.path.exists(os.path.join(_fileDir, _file)):
                _fileExists = True
            elif "/" in _file and os.path.exists(os.path.join(_fileDir, os.path.filepart(_file))):
                # xhtml in a subdirectory for output files may refer to an image file in parent directory
                _fileExists = True
                _file = os.path.filepart(_file)
            if not _fileExists:
                self.cntlr.addToLog("http://localhost:{}/{}".format(self.port, file), messageCode="localViewer:fileNotFound", level=logging.DEBUG)
            return static_file(_file, root=_fileDir, headers=self.noCacheHeaders)  # extra_headers modification to py-bottle
        return static_file(file, root="/")  # probably can't get here unless path is wrong


def guiRun(cntlr, modelXbrl, attach, *args, **kwargs):
    """ run iXBRL Viewer using GUI interactions for a single instance or testcases """
    try:
        import webbrowser
        global tempViewer
        tempViewer = tempfile.TemporaryDirectory()
        viewer_file_name = 'ixbrlviewer.html'
        generateViewer(cntlr, tempViewer.name, useStubViewer=True)
        localViewer = iXBRLViewerLocalViewer("iXBRL Viewer",  os.path.dirname(__file__))
        localhost = localViewer.init(cntlr, tempViewer.name)
        webbrowser.open(f'{localhost}/{viewer_file_name}')
    except Exception as ex:
        modelXbrl.error(
            "viewer:exception",
            "Exception %(exception)s \sTraceback %(traceback)s",
            modelObject=modelXbrl, exception=ex, traceback=traceback.format_tb(sys.exc_info()[2])
        )


def load_plugin_url():
    return __file__


__pluginInfo__ = {
    'name': 'ixbrl-viewer',
    'version': '0.1',
    'description': "iXBRL Viewer creator",
    'license': 'License :: OSI Approved :: Apache License, Version 2.0 (Apache-2.0)',
    'author': 'Paul Warren',
    'copyright': 'Copyright :: Workiva Inc. :: 2019',
    'CntlrCmdLine.Options': commandLineOptionExtender,
    'CntlrCmdLine.Xbrl.Run': commandLineRun,
    'CntlrWinMain.Menu.Tools': toolsMenuExtender,
    'CntlrWinMain.Menu.View': viewMenuExtender,
    'CntlrWinMain.Xbrl.Loaded': guiRun,
}
