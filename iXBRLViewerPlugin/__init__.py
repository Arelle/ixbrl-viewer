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
from pathlib import Path

from arelle import Cntlr
from arelle.LocalViewer import LocalViewer
from arelle.ModelDocument import Type
from arelle.UrlUtil import isHttpUrl
from arelle.webserver.bottle import static_file

from .constants import CONFIG_COPY_SCRIPT, CONFIG_FEATURE_PREFIX, CONFIG_LAUNCH_ON_LOAD, \
    CONFIG_SCRIPT_URL, DEFAULT_COPY_SCRIPT, DEFAULT_LAUNCH_ON_LOAD, DEFAULT_OUTPUT_NAME, \
    DEFAULT_JS_FILENAME, DEFAULT_VIEWER_PATH, ERROR_MESSAGE_CODE, \
    EXCEPTION_MESSAGE_CODE, FEATURE_CONFIGS
from .iXBRLViewer import IXBRLViewerBuilder, IXBRLViewerBuilderError

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
                      help="A filepath or URL to the iXBRL Viewer JavaScript file which will be downloaded or copied into the output directory."
                           " If a relative filepath is to be copied it will be resolved relative to the current working directory."
                           " If '--viewer-no-copy-script' is used, the '--viewer-url' file will not be copied or downloaded and instead directly referenced from the HTML file."
                           " Examples: 'customViewerScript.js', '/path/to/ixbrlviewer.js', 'https://example.com/ixbrlviewer.js'."
                           f" The default value is '{DEFAULT_JS_FILENAME}'.")
    parser.add_option("--viewer-no-copy-script",
                      action="store_true",
                      dest="viewerNoCopyScript",
                      default=False,
                      help="Prevent copying the iXBRL Viewer's JavaScript file from '--viewer-url' into the output directory."
                           " If used, the iXBRL Viewer HTML file will reference the '--viewer-url' directly."
                           " It must be a valid script location at the time the viewer is opened in a browser.")
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

    # Force "keepOpen" to true, so that all models are retained.  Needed for
    # multi-instance viewers.
    parser.set_defaults(keepOpen = True)

    featureGroup = OptionGroup(parser, "Viewer Features",
                            "See viewer README for information on enabling/disabling features.")
    for featureConfig in FEATURE_CONFIGS:
        arg = f'--viewer-feature-{featureConfig.key}'
        featureGroup.add_option(arg, arg.lower(), action="store_true", default=False, help=featureConfig.description)
    parser.add_option_group(featureGroup)


def generateViewer(
        cntlr: Cntlr,
        saveViewerDest: io.BytesIO | str | None,
        viewerURL: str | None = None,
        showValidationMessages: bool = False,
        useStubViewer: bool = False,
        zipViewerOutput: bool = False,
        features: list[str] | None = None,
        packageDownloadURL: str | None = None,
        copyScript: bool = True,
) -> None:
    """
    Generate and save an iXBRL viewer at the given destination (file, directory, or in-memory file) with the given viewer script URL.
    If copyScript is True the viewer script will be copied into the output destination.
    :param cntlr: The arelle controller that contains the model to be included in the viewer
    :param saveViewerDest: The target that viewer data/files will be written to (path to file or directory, or a file object itself).
    :param viewerURL: The filepath or URL location of the iXBRL Viewer JavaScript file.
    :param showValidationMessages: True if validation messages should be shown in the viewer.
    :param useStubViewer: True if the stub viewer should be used.
    :param zipViewerOutput: True if the destination is a zip archive.
    :param features: Optional list of features to enable.
    :param packageDownloadURL: Optional URL to use as the report package download URL.
    :param copyScript: Controls if the script referenced by viewerURL is copied into the output directory, or directly set as the 'src' value of the script tag in the HTML iXBRL Viewer.
    """
    # extend XBRL-loaded run processing for this option
    abortGenerationMsg = "Skipping iXBRL Viewer generation."
    if not saveViewerDest:
        cntlr.addToLog(f"iXBRL Viewer destination not provided. {abortGenerationMsg}", messageCode=EXCEPTION_MESSAGE_CODE)
        return

    viewerURL = viewerURL or DEFAULT_VIEWER_PATH

    if (cntlr.modelManager is None
        or len(cntlr.modelManager.loadedModelXbrls) == 0
        or any(not mx.modelDocument for mx in cntlr.modelManager.loadedModelXbrls)):
        cntlr.addToLog(f"No taxonomy loaded. {abortGenerationMsg}", messageCode=ERROR_MESSAGE_CODE)
        return
    if cntlr.modelManager.modelXbrl.modelDocument.type not in (Type.INLINEXBRL, Type.INLINEXBRLDOCUMENTSET):
        cntlr.addToLog(f"No inline XBRL document loaded. {abortGenerationMsg}", messageCode=ERROR_MESSAGE_CODE)
        return

    copyScriptPath = None
    if copyScript:
        originalViewerURL = viewerURL
        viewerPath = None
        if isHttpUrl(originalViewerURL):
            cacheScript = cntlr.webCache.getfilename(originalViewerURL)
            if cacheScript and (cacheScriptPath := Path(cacheScript)).is_file():
                viewerPath = cacheScriptPath
            else:
                downloadFailedErrorMessage = f"Unable to download iXBRL Viewer script '{originalViewerURL}'."
                if cntlr.webCache.workOffline:
                    downloadFailedErrorMessage += " Disable offline mode and try again."
                cntlr.addToLog(f"{downloadFailedErrorMessage} {abortGenerationMsg}", messageCode=EXCEPTION_MESSAGE_CODE)
                return

        if not viewerPath:
            viewerPath = Path(viewerURL)
        copyScriptPath = viewerPath.resolve()
        viewerURL = viewerPath.name
        if not viewerPath.is_file():
            cntlr.addToLog(f"iXBRL Viewer script not found at '{viewerPath}'. {abortGenerationMsg}", messageCode=EXCEPTION_MESSAGE_CODE)
            return

    try:
        viewerBuilder = IXBRLViewerBuilder(cntlr.modelManager.loadedModelXbrls)
        if features:
            for feature in features:
                viewerBuilder.enableFeature(feature)
        iv = viewerBuilder.createViewer(scriptUrl=viewerURL, showValidations=showValidationMessages, useStubViewer=useStubViewer, packageDownloadURL=packageDownloadURL)
        if iv is not None:
            iv.save(saveViewerDest, zipOutput=zipViewerOutput, copyScriptPath=copyScriptPath)
    except IXBRLViewerBuilderError as ex:
        print(ex)
    except Exception as ex:
        tb = traceback.format_tb(sys.exc_info()[2])
        cntlr.addToLog(f"Exception {ex} \nTraceback {tb}", messageCode=EXCEPTION_MESSAGE_CODE)


def getFeaturesFromOptions(options: argparse.Namespace | OptionParser):
    return [
        featureConfig.key
        for featureConfig in FEATURE_CONFIGS
        if getattr(options, f'viewer_feature_{featureConfig.key}') or getattr(options, f'viewer_feature_{featureConfig.key.lower()}')
    ]


def iXBRLViewerCommandLineXbrlRun(cntlr, options, *args, **kwargs):
    generateViewer(
        cntlr=cntlr,
        saveViewerDest=options.saveViewerDest or kwargs.get("responseZipStream"),
        viewerURL=options.viewerURL,
        copyScript=not options.viewerNoCopyScript,
        showValidationMessages=options.validationMessages,
        useStubViewer=options.useStubViewer,
        zipViewerOutput=options.zipViewerOutput,
        features=getFeaturesFromOptions(options),
        packageDownloadURL=options.packageDownloadURL,
    )


def iXBRLViewerSaveCommand(cntlr):
    from .ui import SaveViewerDialog
    if cntlr.modelManager is None or cntlr.modelManager.modelXbrl is None:
        cntlr.addToLog("No document loaded.", messageCode=ERROR_MESSAGE_CODE)
        return
    modelXbrl = cntlr.modelManager.modelXbrl
    if modelXbrl.modelDocument.type not in (Type.INLINEXBRL, Type.INLINEXBRLDOCUMENTSET):
        cntlr.addToLog("No inline XBRL document loaded.", messageCode=ERROR_MESSAGE_CODE)
        return
    dialog = SaveViewerDialog(cntlr)
    dialog.render()
    if dialog.accepted and dialog.filename():
        generateViewer(
            cntlr=cntlr,
            saveViewerDest=dialog.filename(),
            viewerURL=dialog.scriptUrl(),
            copyScript=dialog.copyScript(),
            zipViewerOutput=dialog.zipViewerOutput(),
            features=dialog.features(),
        )


def iXBRLViewerSettingsCommand(cntlr):
    from .ui import SettingsDialog
    SettingsDialog(cntlr).render()


def iXBRLViewerToolsMenuExtender(cntlr, menu, *args, **kwargs):
    # Add Tools menu
    from tkinter import Menu  # must only import if GUI present (no tkinter on GUI-less servers)
    viewerMenu = Menu(cntlr.menubar, tearoff=0)
    menu.add_cascade(label=_("iXBRL Viewer"), menu=viewerMenu, underline=0)

    # Extend menu with settings and save dialogs
    viewerMenu.add_command(
        label="Settings...",
        underline=0,
        command=lambda: iXBRLViewerSettingsCommand(cntlr))
    viewerMenu.add_command(
        label="Save Viewer...",
        underline=0,
        command=lambda: iXBRLViewerSaveCommand(cntlr))


def toolsMenuExtender(cntlr, menu, *args, **kwargs):
    iXBRLViewerToolsMenuExtender(cntlr, menu, *args, **kwargs)


def commandLineOptionExtender(*args, **kwargs):
    iXBRLViewerCommandLineOptionExtender(*args, **kwargs)


def commandLineRun(*args, **kwargs):
    iXBRLViewerCommandLineXbrlRun(*args, **kwargs)


class iXBRLViewerLocalViewer(LocalViewer):
    # plugin-specific local file handler
    def getLocalFile(self, file, relpath, request):
        if file == DEFAULT_JS_FILENAME:
            return static_file(DEFAULT_JS_FILENAME, os.path.dirname(DEFAULT_VIEWER_PATH))
        _report, _, _file = file.partition("/")
        if _report.isnumeric():  # in reportsFolder folder
            # check if file is in the current or parent directory
            _fileDir = self.reportsFolders[int(_report)]
            _fileExists = False
            if os.path.exists(os.path.join(_fileDir, _file)):
                _fileExists = True
            elif "/" in _file and os.path.exists(os.path.join(_fileDir, os.path.basename(_file))):
                # xhtml in a subdirectory for output files may refer to an image file in parent directory
                _fileExists = True
                _file = os.path.basename(_file)
            if not _fileExists:
                self.cntlr.addToLog("http://localhost:{}/{}".format(self.port, file), messageCode="localViewer:fileNotFound", level=logging.DEBUG)
            return static_file(_file, root=_fileDir, headers=self.noCacheHeaders)  # extra_headers modification to py-bottle
        return static_file(file, root="/")  # absolute path used for ixbrlviewer.js.


def guiRun(cntlr, modelXbrl, attach, *args, **kwargs):
    """ run iXBRL Viewer using GUI interactions for a single instance or testcases """
    if not cntlr.config.setdefault(CONFIG_LAUNCH_ON_LOAD, DEFAULT_LAUNCH_ON_LOAD):
        # Don't run on launch if the option has been disabled
        return
    try:
        import webbrowser
        global tempViewer
        tempViewer = tempfile.TemporaryDirectory()
        viewer_file_name = DEFAULT_OUTPUT_NAME
        features = [
            c.key
            for c in FEATURE_CONFIGS
            if cntlr.config.setdefault(f'{CONFIG_FEATURE_PREFIX}{c.key}', False)
        ]
        generateViewer(
            cntlr=cntlr,
            saveViewerDest=tempViewer.name,
            viewerURL=cntlr.config.get(CONFIG_SCRIPT_URL),
            copyScript=cntlr.config.get(CONFIG_COPY_SCRIPT, DEFAULT_COPY_SCRIPT),
            useStubViewer=True,
            features=features,
        )
        if Path(tempViewer.name, viewer_file_name).exists():
            localViewer = iXBRLViewerLocalViewer("iXBRL Viewer",  os.path.dirname(__file__))
            localhost = localViewer.init(cntlr, tempViewer.name)
            webbrowser.open(f'{localhost}/{viewer_file_name}')
    except Exception as ex:
        modelXbrl.error(
            EXCEPTION_MESSAGE_CODE,
            "Exception %(exception)s \nTraceback %(traceback)s",
            modelObject=modelXbrl, exception=ex, traceback=traceback.format_tb(sys.exc_info()[2])
        )


def load_plugin_url():
    return __file__


__pluginInfo__ = {
    'name': 'ixbrl-viewer',
    'aliases': [
        'iXBRLViewerPlugin',
    ],
    'version': '0.1',
    'description': "iXBRL Viewer creator",
    'license': 'License :: OSI Approved :: Apache License, Version 2.0 (Apache-2.0)',
    'author': 'Paul Warren',
    'copyright': 'Copyright :: Workiva Inc. :: 2019',
    'CntlrCmdLine.Options': commandLineOptionExtender,
    'CntlrCmdLine.Filing.End': commandLineRun,
    'CntlrWinMain.Menu.Tools': toolsMenuExtender,
    'CntlrWinMain.Xbrl.Loaded': guiRun,
}
