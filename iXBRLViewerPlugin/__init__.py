from .iXBRLViewer import iXBRLViewerCommandLineOptionExtender, iXBRLViewerCommandLineXbrlRun, iXBRLViewerMenuExtender

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
