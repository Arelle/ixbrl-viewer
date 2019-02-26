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

all: dev samples

samples:
	$(MAKE) -C $@

dev: iXBRLViewerPlugin/viewer/dist/ixbrl_viewer.dev.js

prod: iXBRLViewerPlugin/viewer/dist/ixbrl_viewer.js

iXBRLViewerPlugin/viewer/dist/ixbrl_viewer.dev.js:	iXBRLViewerPlugin/viewer/src/*/*
	cd iXBRLViewerPlugin/viewer && npx webpack --config webpack.dev.js --optimize-minimize

iXBRLViewerPlugin/viewer/dist/ixbrl_viewer.js:	iXBRLViewerPlugin/viewer/src/*/*
	cd iXBRLViewerPlugin/viewer && npx webpack --config webpack.prod.js --optimize-minimize

test: testplugin testviewer

testplugin:
	PYTHONPATH=Arelle python3 iXBRLViewerPlugin/tests/iXBRLViewerTests.py

testviewer:
	npm run test



DATE ::= $(shell date "+%Y%m%d")
DIST ::= ixbrl_viewer-$(DATE)
dist: prod
	mkdir -p $(DIST)
	cp -r iXBRLViewerPlugin js/dist/ixbrlviewer.js $(DIST)
	zip -r $(DIST).zip $(DIST) -x \*/__pycache__/\* \*/.\*
	
.PHONY: tests
