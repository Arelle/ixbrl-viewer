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

from arelle.webserver.bottle import static_file
from arelle.LocalViewer import LocalViewer
import os, logging, sys

class _LocalViewer(LocalViewer):
    # plugin-specific local file handler
    def getLocalFile(self, file=None, relpath=None):
        if file == 'favicon.ico':
            return static_file("arelle.ico", root=self.cntlr.imagesDir, mimetype='image/vnd.microsoft.icon')
        _report, _sep, _file = file.partition("/")
        if _report.isnumeric(): # in reportsFolder folder
            if _file == "ixbrlviewer.js":
                root = os.path.join(self.reportsFolders[0], "viewer", "dist")
                return static_file(_file, root=root, mimetype='text/javascript')
            else:
                root = self.reportsFolders[int(_report)]
            return static_file(_file, root=root, # extra_headers modification to py-bottle
                               more_headers={'Cache-Control': 'no-cache, no-store, must-revalidate',
                                             'Pragma': 'no-cache',
                                             'Expires': '0'})
        return static_file(file, root="/") # probably can't get here unless path is wrong

localViewer = _LocalViewer("iXBRLViewer local viewer", os.path.dirname(__file__)) # plugin singleton local viewer class

def init(cntlr, reportsFolder): # returns browser root
    return localViewer.init(cntlr, reportsFolder)
