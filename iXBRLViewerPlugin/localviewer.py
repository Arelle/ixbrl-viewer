# Copyright 2019 Workiva Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from arelle.LocalViewer import LocalViewer
from arelle.webserver.bottle import static_file
from arelle.FileSource import archiveFilenameParts
import os, shutil
import logging
import zipfile, sys, traceback

from .iXBRLViewer import IXBRLViewerBuilder

VIEWER_BASENAME_SUFFIX = "_ixbrlview"

class iXBRLViewerLocalViewer(LocalViewer):
    # plugin-specific local file handler
    def getLocalFile(self, file, relpath, request):
        _report, _sep, _file = file.partition("/")
        if file == 'ixbrlviewer.js':
            return static_file('ixbrlviewer.js', os.path.abspath(os.path.join(os.path.dirname(__file__), "viewer", "dist")))
        elif _report.isnumeric(): # in reportsFolder folder
            # check if file is in the current or parent directory (may bve
            _fileDir = self.reportsFolders[int(_report)]
            _fileExists = False
            if os.path.exists(os.path.join(_fileDir, _file)):
                _fileExists = True
            elif "/" in _file and os.path.exists(os.path.join(_fileDir, os.path.filepart(_file))):
                # xhtml in a subdirectory for output files may refer to an image file in parent directory
                _fileExists = True
                _file = os.path.filepart(_file)
            if not _fileExists:
                self.cntlr.addToLog("http://localhost:{}/{}".format(self.port,file), messageCode="localViewer:fileNotFound",level=logging.DEBUG)
            return static_file(_file, root=_fileDir, more_headers=self.noCacheHeaders) # extra_headers modification to py-bottle
        return static_file(file, root="/") # probably can't get here unless path is wrong

localViewer = iXBRLViewerLocalViewer("iXBRL Viewer",  os.path.dirname(__file__))

def launchLocalViewer(cntlr, modelXbrl):
    from arelle import LocalViewer
    try:
        viewerBuilder = IXBRLViewerBuilder(cntlr.modelManager.modelXbrl)
        iv = viewerBuilder.createViewer(scriptUrl="/ixbrlviewer.js")
        # first check if source file was in an archive (e.g., taxonomy package)
        _archiveFilenameParts = archiveFilenameParts(modelXbrl.modelDocument.filepath)
        if _archiveFilenameParts is not None:
            outDir = os.path.dirname(_archiveFilenameParts[0]) # it's a zip or package
        else: 
            outDir = modelXbrl.modelDocument.filepathdir
        _localhost = localViewer.init(cntlr, outDir)
        # for IXDS, outPath must be a directory name, suffix is applied in saving files
        if len(iv.files) > 1:
            # save files in a separate directory from source files
            _localhost += "/" + VIEWER_BASENAME_SUFFIX
            outDir = os.path.join(outDir, VIEWER_BASENAME_SUFFIX)
            os.makedirs(outDir, exist_ok=True)
            iv.save(outDir) # no changes to html inline files so inter-file refereences still can work
            htmlFile = iv.files[0].filename
        else:
            iv.save(outDir, outBasenameSuffix=VIEWER_BASENAME_SUFFIX)
            htmlFile = "{0[0]}{1}{0[1]}".format(os.path.splitext(modelXbrl.modelDocument.basename), VIEWER_BASENAME_SUFFIX)
        import webbrowser
        webbrowser.open(url="{}/{}".format(_localhost, htmlFile))
    except Exception as ex:
        modelXbrl.error("viewer:exception",
                        "Exception %(exception)s \sTraceback %(traceback)s",
                        modelObject=modelXbrl, exception=ex, traceback=traceback.format_tb(sys.exc_info()[2]))

