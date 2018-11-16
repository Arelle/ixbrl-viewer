SRCS = $(wildcard *.ixtmpl)
DOCS = $(SRCS:%.ixtmpl=%)


all: $(DOCS:%=%-viewer.html)

%-viewer.html: %.html
	python3 /home/pdw/Arelle/arelleCmdLine.py '--packages=/home/pdw/c.b.c/client-xii/gleif-accounts/IFRST_2017-03-09-es.zip|packages/us-gaap-2016-01-31-package.zip' --plugins=/home/pdw/c.b.c/clients/workiva/iXBRLViewer/iXBRLViewerPlugin/ -v -f $< --save-viewer=$@ --viewer-url=../js/dist/ixbrlviewer.dev.js
	
%.html: %.ixtmpl
	/home/pdw/c.b.c/xbrl/ixbrl-templates/ixbrltemplate.py $< > $@
