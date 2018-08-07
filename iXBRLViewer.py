from arelle import ModelDtsObject, XbrlConst, XmlUtil, ModelValue 
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

def lineWrap(s, n = 80):
    return "\n".join([s[i:i+n] for i in range(0, len(s), n)])

def saveViewer(dts, outFile):
    '''Save an iXBRL Viewer HTML file with iXBRL embedded as a base64 blob and taxonomy info as a JSON blob
    '''
    idGen = 0
    taxonomyData = {
        "concepts": {},
        "facts": {},
    }
    nsmap = NamespaceMap()
    roleMap = NamespaceMap()
    roleMap.getPrefix(XbrlConst.standardLabel,"std")
    roleMap.getPrefix(XbrlConst.documentationLabel,"doc")
    
    for f in dts.facts:
        if f.id is None:
            f.set("id","ixv-%d" % (idGen))
        idGen += 1
        conceptName = "%s:%s" % (nsmap.getPrefix(f.qname.namespaceURI, f.qname.prefix), f.qname.localName)
        taxonomyData["facts"][f.id] = {
            "format": str(f.format),
            "value": f.value,
            "concept": conceptName,
        }
        labelsRelationshipSet = dts.relationshipSet(XbrlConst.conceptLabel)
        #dts.info("info:iXBRLViewer", "Fact: %s" % f.concept.qname)
        labels = labelsRelationshipSet.fromModelObject(f.concept)

        if conceptName not in taxonomyData["concepts"]:
            conceptData = {
                "labels": { "test": "</script>" }
            }
            for lr in labels:
                l = lr.toModelObject
                conceptData["labels"].setdefault(roleMap.getPrefix(l.role),{})[l.xmlLang.lower()] = l.text;

            taxonomyData["concepts"][conceptName] = conceptData

    taxonomyData["prefixes"] = nsmap.prefixmap
    taxonomyData["roles"] = roleMap.prefixmap

    # Escape anything that looks like the start of a close element tag (i.e. </script>)
    # The only place this can legally appear is inside a string literal.    
    taxonomyDataJSON = json.dumps(taxonomyData, indent=1).replace("</",'<\/')
    #taxonomyDataJSON = json.dumps(taxonomyData, indent=None, separators=(",",":"))

    dts.info("viewer:info", "Saving iXBRL viewer to %s" % (outFile))
    xml = io.StringIO()
    XmlUtil.writexml(xml, dts.modelDocument.xmlDocument, encoding="utf-8")
    b64 = lineWrap(base64.b64encode(xml.getvalue().encode("utf-8")).decode('ascii'))

    path = os.path.join(os.path.dirname(os.path.realpath(__file__)), "templates")
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(path),
        autoescape=jinja2.select_autoescape(['html'])
    )
    template = env.get_template("ixbrlviewer.tmpl")
    with open(outFile, "w") as fout:
        fout.write(template.render(data=b64, taxonomyData = taxonomyDataJSON))


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
        saveViewer(cntlr.modelManager.modelXbrl, outFile)


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
