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

SRCS = $(wildcard *.ixtmpl)
DOCS = $(SRCS:%.ixtmpl=%)


all: $(DOCS:%=%-viewer.html)

%-viewer.html: %.html
	python3 ../Arelle/arelleCmdLine.py '--packages=packages/us-gaap-2016-01-31-package.zip|packages/IFRST_2017-03-09-es.zip' --plugins=$(shell pwd)/../iXBRLViewerPlugin/ -v -f $< --save-viewer=$@ --viewer-url=../viewer/dist/ixbrlviewer.dev.js
	
#%.html: %.ixtmpl
#	/home/pdw/c.b.c/xbrl/ixbrl-templates/ixbrltemplate.py $< -o $@
