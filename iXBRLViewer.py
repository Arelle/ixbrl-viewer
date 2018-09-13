from arelle import ModelDtsObject, XbrlConst, XmlUtil, ModelValue 
from lxml import etree
import json
import base64
import io
import os
import jinja2

class NamespaceMap:
    """Class for building a 1:1 map of prefixes to namespace URIs

    Will attempt to use a provided, preferred prefix, but will uniquify as
    required.
    """

    def __init__(self):
        self.nsmap = dict()
        self.prefixmap = dict()

    def getPrefix(self, ns, preferredPrefix = None):
        """Get the prefix for the specified namespace.

        If no prefix is yet defined, define one using the preferred prefix, if
        provided and not yet used, otherwise add a number to the end of the preferred
        prefix (or the string "ns")
        """
    
        prefix = self.nsmap.get(ns, None)
        if not prefix:
            if preferredPrefix and preferredPrefix not in self.prefixmap:
                prefix = preferredPrefix
            else:
                p = preferredPrefix if preferredPrefix else "ns";
                n = 0
                while "%s%d" % (p,n) in self.prefixmap:
                    n += 1
                
                prefix = "%s%d" % (p,n)
                    
            self.prefixmap[prefix] = ns
            self.nsmap[ns] = prefix
        return prefix

    def qname(self, qname):
        return "%s:%s" % (self.getPrefix(qname.namespaceURI, qname.prefix), qname.localName)


class IXBRLViewerBuilder:
    
    def __init__(self, dts):
        self.nsmap = NamespaceMap()
        self.roleMap = NamespaceMap()
        self.dts = dts
        self.taxonomyData = {
            "concepts": {},
            "facts": {},
        }

    def lineWrap(self, s, n = 80):
        return "\n".join([s[i:i+n] for i in range(0, len(s), n)])

    def escapeJSONForScriptTag(self, s):
        """JSON encodes XML special characters

        XML and HTML apply difference escaping rules to content within script
        tags and we need our output to be valid XML, but treated as HTML by browsers.
    
        If we allow XML escaping to occur in a script tag, browsers treating
        the document as HTML won't unescape it.  If we don't escape XML special
        characters, it won't be valid XML.  

        We avoid this whole mess by escaping XML special characters using JSON
        string escapes.  This is only safe to do because < > and & can't occur
        outside a string in JSON.  It can't safely be used on JS.

        """
        return s.replace("<","\\u003C").replace(">","\\u003E").replace("&","\\u0026")
        


    def addConcept(self, concept):
        labelsRelationshipSet = self.dts.relationshipSet(XbrlConst.conceptLabel)
        labels = labelsRelationshipSet.fromModelObject(concept)
        conceptName = self.nsmap.qname(concept.qname)
        if conceptName not in self.taxonomyData["concepts"]:
            conceptData = {
                "labels": {  }
            }
            for lr in labels:
                l = lr.toModelObject
                conceptData["labels"].setdefault(self.roleMap.getPrefix(l.role),{})[l.xmlLang.lower()] = l.text;

            self.taxonomyData["concepts"][conceptName] = conceptData

    def saveViewer(self, outFile):
        '''Save an iXBRL Viewer HTML file with iXBRL embedded as a base64 blob and taxonomy info as a JSON blob
        '''

        dts = self.dts
        idGen = 0
        self.roleMap.getPrefix(XbrlConst.standardLabel,"std")
        self.roleMap.getPrefix(XbrlConst.documentationLabel,"doc")
        
        for f in dts.facts:
            if f.id is None:
                f.set("id","ixv-%d" % (idGen))
            idGen += 1
            conceptName = self.nsmap.qname(f.qname)
            dims = {}
            
            for d, v in f.context.qnameDims.items():
                if v.memberQname is None:
                    # Typed dimension, not yet supported.
                    continue
                dims[self.nsmap.qname(v.dimensionQname)] = self.nsmap.qname(v.memberQname)
                self.addConcept(v.dimension)
                self.addConcept(v.member)

            self.taxonomyData["facts"][f.id] = {
                "f": str(f.format),
                "v": f.value,
                "c": conceptName,
                "d": dims,
            }

            self.addConcept(f.concept)

        self.taxonomyData["prefixes"] = self.nsmap.prefixmap
        self.taxonomyData["roles"] = self.roleMap.prefixmap

        taxonomyDataJSON = self.escapeJSONForScriptTag(json.dumps(self.taxonomyData, indent=1))
        #taxonomyDataJSON = json.dumps(taxonomyData, indent=None, separators=(",",":"))

        dts.info("viewer:info", "Saving iXBRL viewer to %s" % (outFile))

        path = os.path.join(os.path.dirname(os.path.realpath(__file__)), "templates")
        env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(path),
            autoescape=jinja2.select_autoescape(['html'])
        )

        template = env.get_template("ixbrlviewer.js")

        for child in dts.modelDocument.xmlDocument.getroot():
            if child.tag == '{http://www.w3.org/1999/xhtml}body':
                child.append(etree.Comment("BEGIN IXBRL VIEWER EXTENSIONS"))
            
                e = etree.fromstring("<script xmlns='http://www.w3.org/1999/xhtml' src='https://code.jquery.com/jquery-3.3.1.slim.min.js' integrity='sha256-3edrmyuQ0w65f8gfBsqowzjJe2iM6n0nKciPUp8y+7E=' crossorigin='anonymous'></script>")
                e.text = '' # Avoid self-closing script tag
                child.append(e)

                e = etree.fromstring("<script xmlns='http://www.w3.org/1999/xhtml' src='http://code.interactjs.io/v1.3.4/interact.min.js'  />")
                e.text = ''
                child.append(e)

                e = etree.fromstring("<script xmlns='http://www.w3.org/1999/xhtml' src='ixbrlviewer.js'  />")
                e.text = ''
                child.append(e)

                # Putting this in the header can interfere with character set
                # auto detection 
                e = etree.fromstring("<script xmlns='http://www.w3.org/1999/xhtml' id='taxonomy-data' type='application/json'></script>")
                e.text = taxonomyDataJSON 
                child.append(e)

                child.append(etree.Comment("END IXBRL VIEWER EXTENSIONS"))

                break

        with open("ixbrlviewer.js", "w", encoding="utf-8") as fout:
            fout.write(template.render())

        with open(outFile, "wb") as fout:
            #XmlUtil.writexml(fout, dts.modelDocument.xmlDocument, encoding="utf-8", expandEmptyTags=True)

            # Using "xml" permits self-closing tags which confuses an HTML DOM
            fout.write(etree.tostring(dts.modelDocument.xmlDocument, method="xml", encoding="utf-8", xml_declaration=True))

def iXBRLViewerCommandLineOptionExtender(parser, *args, **kwargs):
    parser.add_option("--save-viewer", 
                      action="store", 
                      dest="saveViewerFile", 
                      help=_("Save an HTML viewer file for an iXBRL report"))

def iXBRLViewerCommandLineXbrlRun(cntlr, options, modelXbrl, *args, **kwargs):
    # extend XBRL-loaded run processing for this option
    if cntlr.modelManager is None or cntlr.modelManager.modelXbrl is None:
        cntlr.addToLog("No taxonomy loaded.")
        return
    outFile = getattr(options, 'saveViewerFile', False)
    if outFile:
        viewerBuilder = IXBRLViewerBuilder(cntlr.modelManager.modelXbrl)
        viewerBuilder.saveViewer(outFile)


__pluginInfo__ = {
    'name': 'Create iXBRL Viewer',
    'version': '0.1',
    'description': "",
    'license': '',
    'author': 'Paul Warren',
    'copyright': '',
    'CntlrCmdLine.Options': iXBRLViewerCommandLineOptionExtender,
    'CntlrCmdLine.Xbrl.Run': iXBRLViewerCommandLineXbrlRun,
}
