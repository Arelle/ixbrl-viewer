from .iXBRLViewer import IXBRLViewerBuilder
from .ui import SaveViewerDialog

def iXBRLViewerCommandLineOptionExtender(parser, *args, **kwargs):
    parser.add_option("--save-viewer",
                      action="store",
                      dest="saveViewerFile",
                      help="Save an HTML viewer file for an iXBRL report")
    parser.add_option("--viewer-url",
                      action="store",
                      dest="viewerURL",
                      default="js/dist/ixbrlviewer.js",
                      help="Specify the URL to ixbrlviewer.js")


def iXBRLViewerCommandLineXbrlRun(cntlr, options, *args, **kwargs):
    # extend XBRL-loaded run processing for this option
    if cntlr.modelManager is None or cntlr.modelManager.modelXbrl is None:
        cntlr.addToLog("No taxonomy loaded.")
        return
    outFile = getattr(options, 'saveViewerFile', False)
    if outFile:
        viewerBuilder = IXBRLViewerBuilder(cntlr.modelManager.modelXbrl)
        xmlDocument = viewerBuilder.createViewer(scriptUrl=options.viewerURL)
        viewerBuilder.saveViewer(outFile, xmlDocument)


def iXBRLViewerMenuCommand(cntlr):
    if cntlr.modelManager is None or cntlr.modelManager.modelXbrl is None:
        cntlr.addToLog("No document loaded.")
        return
    dialog = SaveViewerDialog(cntlr)
    if dialog.accepted and dialog.filename() != "":
        viewerBuilder = IXBRLViewerBuilder(cntlr.modelManager.modelXbrl)
        xmlDocument = viewerBuilder.createViewer(scriptUrl=dialog.scriptUrl())
        viewerBuilder.saveViewer(dialog.filename(), xmlDocument)


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


__pluginInfo__ = {
    'name': 'Create iXBRL Viewer',
    'version': '0.1',
    'description': "",
    'license': '',
    'author': 'Paul Warren',
    'copyright': '',
    'imports': [ "./iXBRLViewer.py" ],
    'CntlrCmdLine.Options': commandLineOptionExtender,
    'CntlrCmdLine.Xbrl.Run': commandLineRun,
    'CntlrWinMain.Menu.Tools': menuExtender,
}
