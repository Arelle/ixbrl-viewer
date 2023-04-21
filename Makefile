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

all: dev

samples: Arelle
	$(MAKE) -C $@

dev: iXBRLViewerPlugin/viewer/dist/ixbrl_viewer.dev.js

prod: iXBRLViewerPlugin/viewer/dist/ixbrl_viewer.js

iXBRLViewerPlugin/viewer/dist/ixbrl_viewer.dev.js:	iXBRLViewerPlugin/viewer/src/*/*
	npm run dev

iXBRLViewerPlugin/viewer/dist/ixbrl_viewer.js:	iXBRLViewerPlugin/viewer/src/*/*
	npm run prod

test: testplugin testviewer

testplugin:
	nose2

Arelle:
	git clone https://github.com/Arelle/Arelle.git Arelle

testviewer:
	npm run test



DATE ::= $(shell date "+%Y%m%d")
DIST ::= ixbrl_viewer-$(DATE)
dist: prod
	mkdir -p $(DIST)
	cp -r iXBRLViewerPlugin js/dist/ixbrlviewer.js $(DIST)
	zip -r $(DIST).zip $(DIST) -x \*/__pycache__/\* \*/.\*
	
.PHONY: samples
