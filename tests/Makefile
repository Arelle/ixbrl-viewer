

all: testdoc-viewer.html
	

testdoc-viewer.html: testdoc.html
	python3 /home/pdw/Arelle/arelleCmdLine.py --packages=/home/pdw/c.b.c/client-xii/gleif-accounts/IFRST_2017-03-09-es.zip --plugins=/home/pdw/c.b.c/clients/workiva/iXBRLViewer/iXBRLViewerPlugin/ -v -f testdoc.html --save-viewer=testdoc-viewer.html --viewer-url=../js/dist/ixbrlviewer.js
	
testdoc.html: testdoc.ixtmpl
	/home/pdw/c.b.c/xbrl/ixbrl-templates/ixbrltemplate.py testdoc.ixtmpl > testdoc.html
