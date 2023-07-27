#!/usr/bin/env python3

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

import arelle.FileSource
from arelle import PackageManager, Cntlr, PluginManager
from arelle.ModelFormulaObject import FormulaOptions
import os
import sys
import glob
import argparse
import iXBRLViewerPlugin.iXBRLViewer
from arelle.plugin import inlineXbrlDocumentSet
from iXBRLViewerPlugin import generateViewer, getFeaturesFromOptions, VIEWER_FEATURES_AND_DESCRIPTIONS

class CntlrCreateViewer(Cntlr.Cntlr):

    def __init__(self):
        super(CntlrCreateViewer, self).__init__(hasGui=False)

    def loadPackagesFromDir(self, directory):
        packages = glob.glob(os.path.join(directory, "*.zip"))
        for p in packages:
            pi = PackageManager.addPackage(self, p)
            if pi:
                self.addToLog("Package added", messageCode="info", file=pi.get("URL"))
            else:
                self.addToLog("Failed to load package", messageCode="error", file=p)
        PackageManager.rebuildRemappings(self)
    
    def createViewer(self, f, scriptUrl=None, outPath=None, useStubViewer=False, features=None):
        if os.path.isdir(f):
            files = glob.glob(os.path.join(f, "*.xhtml")) + glob.glob(os.path.join(f, "*.html")) + glob.glob(os.path.join(f, "*.htm"))
            files.sort()
            if len(files) > 1:
                f = os.path.join(f, inlineXbrlDocumentSet.IXDS_SURROGATE) + inlineXbrlDocumentSet.IXDS_DOC_SEPARATOR.join(files)
            elif len(files) == 1:
                f = files[0]
            else:
                self.addToLog("No xhtml, html or htm files found in directory", messageCode="error", file=f)
                return None
        fs = arelle.FileSource.openFileSource(f, self)
        self.modelManager.load(fs)
        self.modelManager.validate()

        try:
            generateViewer(self, outPath, scriptUrl, showValidationMessages=True, useStubViewer=useStubViewer, features=features)
        except iXBRLViewerPlugin.iXBRLViewer.IXBRLViewerBuilderError as e:
            print(e.message)
            sys.exit(1)

parser = argparse.ArgumentParser(description="Create iXBRL Viewer instances")
parser.add_argument("--package-dir", "-p", help="Path to directory containing taxonomy packages")
parser.add_argument("--viewer-url", "-u", help="URL to ixbrlviewer.js", default="ixbrlviewer.js")
parser.add_argument("--out", "-o", help="File or directory to write output to", default="viewer.html")
parser.add_argument("--use-stub-viewer",
                    action="store_true",
                    help="Use stub viewer for faster loading of inspector (requires web server)")
parser.add_argument('files', metavar='FILES', nargs='+',
                    help='Files to process')
featureGroup = parser.add_argument_group('Viewer Features')
for featureName, featureDescription in VIEWER_FEATURES_AND_DESCRIPTIONS.items():
    arg = f'--viewer-feature-{featureName}'
    featureGroup.add_argument(arg, arg.lower(), action="store_true", default=False, help=featureDescription)

args = parser.parse_args()

cntlr = CntlrCreateViewer()
cntlr.startLogging(
    logFileName='logToPrint',
    logFormat="[%(messageCode)s] %(message)s - %(file)s",
    logLevel="DEBUG",
    logRefObjectProperties=True,
    logToBuffer=True
)
cntlr.modelManager.validateInferDecimals = True
cntlr.modelManager.validateCalcLB = True
cntlr.modelManager.formulaOptions = FormulaOptions()

PluginManager.addPluginModule("transforms/SEC")
PluginManager.addPluginModule("inlineXbrlDocumentSet")
cntlr.modelManager.loadCustomTransforms()
if args.package_dir:
    cntlr.loadPackagesFromDir(args.package_dir)

for f in args.files:
    cntlr.createViewer(
        f,
        outPath=args.out,
        scriptUrl=args.viewer_url,
        useStubViewer=args.use_stub_viewer,
        features=getFeaturesFromOptions(args))
