from arelle import ModelDtsObject, XbrlConst, XmlUtil, ModelValue, XmlUtil
import json
import base64
import io
import os
import jinja2


def lineWrap(s, n = 80):
    return "\n".join([s[i:i+n] for i in range(0, len(s), n)])

'''

'''

def saveViewer(dts, outFile):
    idGen = 0
    taxonomyData = {
        "concepts": [],
        "facts": {},
    }
    for f in dts.facts:
        if f.id is None:
            f.set("id","ixv-%d" % (idGen))
        idGen += 1
        taxonomyData["facts"][f.id] = {
            "format": str(f.format),
            "value": f.value,
        }
        labelsRelationshipSet = dts.relationshipSet(XbrlConst.conceptLabel)
        #dts.info("info:iXBRLViewer", "Fact: %s" % f.concept.qname)
        labels = labelsRelationshipSet.fromModelObject(f.concept)
        conceptData = {
            "name": f.qname.localName,
            "ns": f.qname.prefix,
            "labels": []
        }
        for lr in labels:
            l = lr.toModelObject
            conceptData["labels"].append({
                "lang": l.xmlLang,
                "text": l.textValue,
                "role": l.role,
            })
            #dts.info("info:iXBRLViewer", "%s '%s'" %  (l.xmlLang, l.textValue))
    
        taxonomyData["concepts"].append(conceptData)

    #headElt = XmlUtil.descendants(dts.modelDocument.xmlRootElement,"*", "head")
    #XmlUtil.addChild(
    #    headElt[0],    
    #    XbrlConst.xhtml, 
    #    "script", 
    #    attributes = { "type": "application/json" },
    #    text=json.dumps(taxonomyData, indent=1)
    #)

    #taxonomyDataJSON = json.dumps(taxonomyData, indent=1)
    taxonomyDataJSON = json.dumps(taxonomyData, indent=None, separators=(",",":"))

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
