# See COPYRIGHT.md for copyright information

from __future__ import annotations
import io
import json
import logging
import math
import os
import re
import shutil
import urllib.parse
import zipfile
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any

from arelle import XbrlConst
from arelle.ModelDocument import ModelDocument, Type
from arelle.ModelRelationshipSet import ModelRelationshipSet
from arelle.ModelValue import QName, INVALIDixVALUE
from arelle.ModelXbrl import ModelXbrl
from arelle.UrlUtil import isHttpUrl
from arelle.ValidateXbrlCalcs import inferredDecimals
from lxml import etree

from .constants import DEFAULT_JS_FILENAME, DEFAULT_OUTPUT_NAME, ERROR_MESSAGE_CODE, FEATURE_CONFIGS, INFO_MESSAGE_CODE, MANDATORY_FACTS
from .xhtmlserialize import XHTMLSerializer

REPORT_TYPE_EXTENSIONS = ('.xbrl', '.xhtml', '.html', '.htm', '.json')
UNRECOGNIZED_LINKBASE_LOCAL_DOCUMENTS_TYPE = 'unrecognizedLinkbase'
LINK_QNAME_TO_LOCAL_DOCUMENTS_LINKBASE_TYPE = {
    XbrlConst.qnLinkCalculationLink: 'calcLinkbase',
    XbrlConst.qnLinkDefinitionLink: 'defLinkbase',
    XbrlConst.qnLinkLabelLink: 'labelLinkbase',
    XbrlConst.qnLinkPresentationLink: 'presLinkbase',
    XbrlConst.qnLinkReferenceLink: 'refLinkbase',
}

WIDER_NARROWER_ARCROLE = 'http://www.esma.europa.eu/xbrl/esef/arcrole/wider-narrower'

class NamespaceMap:
    """
    Class for building a 1:1 map of prefixes to namespace URIs
    Will attempt to use a provided, preferred prefix, but will uniquify as
    required.
    """

    def __init__(self):
        self.nsmap = dict()
        self.prefixmap = dict()

    def getPrefix(self, ns, preferredPrefix = None):
        """
        Get the prefix for the specified namespace.

        If no prefix is yet defined, define one using the preferred prefix, if
        provided and not yet used, otherwise add a number to the end of the preferred
        prefix (or the string "ns")
        """

        prefix = self.nsmap.get(ns, None)
        if not prefix:
            if preferredPrefix and preferredPrefix not in self.prefixmap:
                prefix = preferredPrefix
            else:
                p = preferredPrefix if preferredPrefix else "ns"
                n = 0
                while "%s%d" % (p,n) in self.prefixmap:
                    n += 1

                prefix = "%s%d" % (p,n)

            self.prefixmap[prefix] = ns
            self.nsmap[ns] = prefix
        return prefix

    def qname(self, qname):
        return "%s:%s" % (self.getPrefix(qname.namespaceURI, qname.prefix), qname.localName)

class IXBRLViewerBuilderError(Exception):
    pass

def isInlineDoc(doc: ModelDocument | None) -> bool:
    return doc is not None and doc.type in {Type.INLINEXBRL, Type.INLINEXBRLDOCUMENTSET}

class IXBRLViewerBuilder:

    def __init__(self, 
            cntlr: Cntlr,
            basenameSuffix: str = '',
            useStubViewer: bool = False,
            features: dict[str, Any] | None = None,
                 ):
        if features is None:
            features = {}
        featureNames = {c.key for c in FEATURE_CONFIGS}
        for featureName in features:
            assert featureName in featureNames, \
                f'Given feature name `{featureName}` does not match any defined features: {featureNames}'
        self.reportZip = None
        self.nsmap = NamespaceMap()
        self.roleMap = NamespaceMap()
        self.taxonomyData = {
            "sourceReports": [],
            "features": features,
        }
        self.basenameSuffix = basenameSuffix
        self.currentTargetReport = None
        self.useStubViewer = useStubViewer
        self.cntlr = cntlr

        self.idGen = 0
        self.roleMap.getPrefix(XbrlConst.standardLabel, "std")
        self.roleMap.getPrefix(XbrlConst.documentationLabel, "doc")
        self.roleMap.getPrefix(XbrlConst.summationItem, "calc")
        self.roleMap.getPrefix(XbrlConst.summationItem11, "calc11")
        self.roleMap.getPrefix(XbrlConst.parentChild, "pres")
        self.roleMap.getPrefix(XbrlConst.dimensionDefault, "d-d")
        self.roleMap.getPrefix(WIDER_NARROWER_ARCROLE, "w-n")

        self.sourceReportsByFiles = dict()
        self.iv = iXBRLViewer(cntlr)
        if self.useStubViewer:
            self.iv.addFile(iXBRLViewerFile(DEFAULT_OUTPUT_NAME, self.getStubDocument()))

        self.fromSingleZIP = None
        self.reportCount = 0
        self.assets = []

    def outputFilename(self, filename):
        (base, ext) = os.path.splitext(filename)
        return base + self.basenameSuffix + ext

    def lineWrap(self, s, n = 80):
        return "\n".join([s[i:i+n] for i in range(0, len(s), n)])

    def dateFormat(self, d):
        """
        Strip the time component from an ISO date if it's zero
        """
        return re.sub("T00:00:00$", "", d)

    def escapeJSONForScriptTag(self, s):
        """
        JSON encodes XML special characters XML and HTML apply difference escaping rules to content
        within script tags and we need our output to be valid XML, but treated as HTML by browsers.

        If we allow XML escaping to occur in a script tag, browsers treating
        the document as HTML won't unescape it.  If we don't escape XML special
        characters, it won't be valid XML.
        We avoid this whole mess by escaping XML special characters using JSON
        string escapes.  This is only safe to do because < > and & can't occur
        outside a string in JSON.  It can't safely be used on JS.
        """
        return s.replace("<","\\u003C").replace(">","\\u003E").replace("&","\\u0026")

    def addRoleDefinition(self, report: ModelXbrl, elr):
        prefix = self.roleMap.getPrefix(elr)
        if self.currentTargetReport.setdefault("roleDefs",{}).get(prefix, None) is None:
            rts = report.roleTypes.get(elr, [])
            label = next((rt.definition for rt in rts if rt.definition is not None), None)
            if label is not None:
                self.currentTargetReport["roleDefs"].setdefault(prefix,{})["en"] = label

    def addConcept(self, report: ModelXbrl, concept, dimensionType = None):
        if concept is None:
            return
        labelsRelationshipSet = report.relationshipSet(XbrlConst.conceptLabel)
        labels = labelsRelationshipSet.fromModelObject(concept)
        conceptName = self.nsmap.qname(concept.qname)
        if conceptName not in self.currentTargetReport["concepts"]:
            conceptData = {
                "labels": {  }
            }
            for lr in labels:
                l = lr.toModelObject
                conceptData["labels"].setdefault(self.roleMap.getPrefix(l.role),{})[l.xmlLang.lower()] = l.text;
                self.addRoleDefinition(report, l.role)

            refData = []
            for _refRel in concept.modelXbrl.relationshipSet(XbrlConst.conceptReference).fromModelObject(concept):
                ref = []
                for _refPart in _refRel.toModelObject.iterchildren():
                    ref.append([_refPart.localName, _refPart.stringValue.strip()])
                refData.append(ref)

            if len(refData) > 0:
                conceptData['r'] = refData

            if dimensionType is not None:
                conceptData["d"] = dimensionType

            if concept.isEnumeration:
                conceptData["e"] = True

            if concept.isTextBlock:
                conceptData['t'] = True

            if concept.balance is not None:
                conceptData['b'] = concept.balance

            if concept.type is not None:
                conceptData['dt'] = self.nsmap.qname(concept.type.qname)

            if concept.isTypedDimension:
                typedDomainElement = concept.typedDomainElement
                if typedDomainElement is not None:
                    typedDomainName = self.nsmap.qname(typedDomainElement.qname)
                    conceptData['td'] = typedDomainName
                    self.addConcept(report, typedDomainElement)

            self.currentTargetReport["concepts"][conceptName] = conceptData

    def treeWalk(self, rels, item, indent = 0):
        for r in rels.fromModelObject(item):
            if r.toModelObject is not None:
                self.treeWalk(rels, r.toModelObject, indent + 1)

    def getRelationships(self, report: ModelXbrl):
        rels = {}

        for baseSetKey, baseSetModelLinks  in report.baseSets.items():
            arcrole, ELR, linkqname, arcqname = baseSetKey
            if arcrole in (XbrlConst.summationItem, XbrlConst.summationItem11, WIDER_NARROWER_ARCROLE, XbrlConst.parentChild, XbrlConst.dimensionDefault) and ELR is not None:
                self.addRoleDefinition(report, ELR)
                rr = dict()
                relSet = report.relationshipSet(arcrole, ELR)
                for r in relSet.modelRelationships:
                    if r.fromModelObject is not None and r.toModelObject is not None:
                        fromKey = self.nsmap.qname(r.fromModelObject.qname)
                        rel = {
                            "t": self.nsmap.qname(r.toModelObject.qname),
                        }
                        if r.weight is not None:
                            rel['w'] = r.weight
                        rr.setdefault(fromKey, []).append(rel)
                        self.addConcept(report, r.toModelObject)
                        self.addConcept(report, r.fromModelObject)

                rels.setdefault(self.roleMap.getPrefix(arcrole),{})[self.roleMap.getPrefix(ELR)] = rr
        return rels

    def validationErrors(self):
        logHandler = self.cntlr.logHandler
        if getattr(logHandler, "logRecordBuffer") is None:
            raise IXBRLViewerBuilderError("Logging is not configured to use a buffer.  Unable to retrieve validation messages")

        errors = []
        for logRec in getattr(logHandler, "logRecordBuffer"):
            if logRec.levelno > logging.INFO:
                errors.append({
                    "sev": logRec.levelname.title().upper(),
                    "code": getattr(logRec, "messageCode", ""),
                    "msg": logRec.getMessage()
                })

        return errors

    def addFact(self, report: ModelXbrl, f):
        if f.id is None:
            f.set("id","ixv-%d" % (self.idGen))

        self.idGen += 1
        conceptName = self.nsmap.qname(f.qname)
        factList = MANDATORY_FACTS.get(self.taxonomyData["features"].get("mandatory_facts"), [])
        isMandatory = f.qname.localName in factList
        scheme, ident = f.context.entityIdentifier

        aspects = {
            "c": conceptName,
            "e": self.nsmap.qname(QName(self.nsmap.getPrefix(scheme,"e"), scheme, ident)),
            "m": isMandatory
        }

        factData = {
            "a": aspects,
        }

        if f.isNil:
            factData["v"] = None
        elif f.concept is not None and f.concept.isEnumeration:
            qnEnums = f.xValue
            if qnEnums is None:
                factData["v"] = f.value
                factData["err"] = 'INVALID_IX_VALUE'
            else:
                if not isinstance(qnEnums, list):
                    qnEnums = (qnEnums,)
                factData["v"] = " ".join(self.nsmap.qname(qn) for qn in qnEnums)
                for qn in qnEnums:
                    self.addConcept(report, report.qnameConcepts.get(qn))
        else:
            factData["v"] = f.value 
            if f.value == INVALIDixVALUE:
                factData["err"] = 'INVALID_IX_VALUE'

        if f.format is not None:
            factData["f"] = str(f.format)

        if f.isNumeric:
            if f.unit is not None and len(f.unit.measures[0]):
                aspects['u'] = self.oimUnitString(f.unit)
            else:
                # The presence of the unit aspect is used by the viewer to
                # identify numeric facts.  If the fact has no unit (invalid
                # XBRL, but we want to support it for draft documents),
                # include the unit aspect with a null value.
                aspects["u"] = None
            d = inferredDecimals(f)
            if d != float("INF") and not math.isnan(d):
                factData["d"] = d

        for d, v in f.context.qnameDims.items():
            if v.memberQname is not None:
                aspects[self.nsmap.qname(v.dimensionQname)] = self.nsmap.qname(v.memberQname)
                self.addConcept(report, v.member)
                self.addConcept(report, v.dimension, dimensionType = "e")
            elif v.typedMember is not None:
                aspects[self.nsmap.qname(v.dimensionQname)] = v.typedMember.text
                self.addConcept(report, v.dimension, dimensionType = "t")

        if f.context.isForeverPeriod:
            aspects["p"] = "f"
        elif f.context.isInstantPeriod and f.context.instantDatetime is not None:
            aspects["p"] = self.dateFormat(f.context.instantDatetime.isoformat())
        elif f.context.isStartEndPeriod and f.context.startDatetime is not None and f.context.endDatetime is not None:
            aspects["p"] = "%s/%s" % (
                self.dateFormat(f.context.startDatetime.isoformat()),
                self.dateFormat(f.context.endDatetime.isoformat())
            )

        frels = self.footnoteRelationshipSet.fromModelObject(f)
        if frels:
            for frel in frels:
                if frel.toModelObject is not None:
                    factData.setdefault("fn", []).append(frel.toModelObject.id)

        self.currentTargetReport["facts"][f.id] = factData
        self.addConcept(report, f.concept)

    def oimUnitString(self, unit):
        """
        Returns an OIM-format string representation of the given ModelUnit.
        See https://www.xbrl.org/Specification/oim-common/REC-2021-10-13/oim-common-REC-2021-10-13.html#term-unit-string-representation
        :param unit: ModelUnit
        :return: String representation of unit (OIM format)
        """
        numerators, denominators = unit.measures
        numeratorsString = '*'.join(self.nsmap.qname(x) for x in sorted(numerators))
        if denominators:
            denominatorsString = '*'.join(self.nsmap.qname(x) for x in sorted(denominators))
            if len(denominators) > 1:
                if len(numerators) > 1:
                    return "({})/({})".format(numeratorsString, denominatorsString)
                return "{}/({})".format(numeratorsString, denominatorsString)
            else:
                if len(numerators) > 1:
                    return "({})/{}".format(numeratorsString, denominatorsString)
                return "{}/{}".format(numeratorsString, denominatorsString)
        return numeratorsString

    def addViewerData(self, viewerFile, scriptUrl):
        taxonomyDataJSON = self.escapeJSONForScriptTag(json.dumps(self.taxonomyData, indent=1, allow_nan=False))

        for child in viewerFile.xmlDocument.getroot():
            if child.tag == '{http://www.w3.org/1999/xhtml}body':
                for body_child in child:
                    if body_child.tag == '{http://www.w3.org/1999/xhtml}script' and body_child.get('type','') == 'application/x.ixbrl-viewer+json':
                        self.cntlr.addToLog("File already contains iXBRL viewer", messageCode="error")
                        return False

                child.append(etree.Comment("BEGIN IXBRL VIEWER EXTENSIONS"))

                # Insert <script> tags, and make sure that they are in the
                # default namespace, so that browsers in HTML mode will find
                # them.
                nsmap = { None: "http://www.w3.org/1999/xhtml" }
                e = etree.SubElement(child, "{http://www.w3.org/1999/xhtml}script", nsmap = nsmap)
                e.set("type", "text/javascript")
                e.set("src", scriptUrl)
                # Don't self close
                e.text = ''

                # Putting this in the header can interfere with character set
                # auto detection due to its length
                e = etree.SubElement(child, "{http://www.w3.org/1999/xhtml}script", nsmap = nsmap)
                e.set("type", "application/x.ixbrl-viewer+json")
                e.text = taxonomyDataJSON
                child.append(etree.Comment("END IXBRL VIEWER EXTENSIONS"))
                return True
        return False

    def getStubDocument(self):
        with open(os.path.join(os.path.dirname(__file__),"stubviewer.html")) as fin:
            return etree.parse(fin)

    def newTargetReport(self, target):
        return {
            "concepts": {},
            "facts": {},
            "target": target,
        }

    def addSourceReport(self):
        sourceReport = {
            "targetReports": []
        }
        self.taxonomyData["sourceReports"].append(sourceReport)
        return sourceReport

    def processModel(
            self,
            report: ModelXbrl
            ):

        self.footnoteRelationshipSet = ModelRelationshipSet(report, "XBRL-footnotes")
        self.currentTargetReport = self.newTargetReport(getattr(report, "ixdsTarget", None))
        softwareCredits = set()
        for document in report.urlDocs.values():
            if isInlineDoc(document):
                matches = document.creationSoftwareMatches(document.creationSoftwareComment)
                softwareCredits.update(matches)
        if softwareCredits:
            self.currentTargetReport["softwareCredits"] = list(softwareCredits)
        for f in report.facts:
            if f.isTuple:
                for nestedTupleFact in f.ixIter():
                    self.addFact(report, nestedTupleFact)
            else:
                self.addFact(report, f)
        self.currentTargetReport["rels"] = self.getRelationships(report)

        docSetFiles = None
        self.reportCount += 1
        report.info(INFO_MESSAGE_CODE, "Creating iXBRL viewer (%d) [%s]" % (self.reportCount, self.currentTargetReport["target"]))
        if report.modelDocument.type == Type.INLINEXBRLDOCUMENTSET:
            # Sort by object index to preserve order in which files were specified.
            xmlDocsByFilename = {
                os.path.basename(self.outputFilename(doc.filepath)): doc.xmlDocument
                for doc in sorted(report.modelDocument.referencesDocument.keys(), key=lambda x: x.objectIndex)
                if doc.type == Type.INLINEXBRL
            }
            docSetFiles = list(xmlDocsByFilename.keys())

            for filename, docSetXMLDoc in xmlDocsByFilename.items():
                self.iv.addFile(iXBRLViewerFile(filename, docSetXMLDoc))

        elif self.useStubViewer:
            filename = self.outputFilename(os.path.basename(report.modelDocument.filepath))
            docSetFiles = [ filename ]
            self.iv.addFile(iXBRLViewerFile(filename, report.modelDocument.xmlDocument))

        else:
            srcFilename = self.outputFilename(os.path.basename(report.modelDocument.filepath))
            docSetFiles = [ srcFilename ]
            filename = srcFilename
            self.iv.addFile(iXBRLViewerFile(filename, report.modelDocument.xmlDocument))
        docSetKey = frozenset(docSetFiles)
        sourceReport = self.sourceReportsByFiles.get(docSetKey)
        if sourceReport is None:
            sourceReport = self.addSourceReport()
            self.sourceReportsByFiles[docSetKey] = sourceReport
            sourceReport["docSetFiles"] = list(urllib.parse.quote(f) for f in docSetFiles)

        sourceReport["targetReports"].append(self.currentTargetReport)

        localDocs = defaultdict(set)
        for path, doc in report.urlDocs.items():
            if isHttpUrl(path) or doc.type == Type.INLINEXBRLDOCUMENTSET:
                continue
            if doc.type == Type.INLINEXBRL:
                localDocs[doc.basename].add('inline')
            elif doc.type == Type.SCHEMA:
                localDocs[doc.basename].add('schema')
            elif doc.type == Type.LINKBASE:
                linkbaseIdentifed = False
                for child in doc.xmlRootElement.iterchildren():
                    linkbaseLocalDocumentsKey = LINK_QNAME_TO_LOCAL_DOCUMENTS_LINKBASE_TYPE.get(child.qname)
                    if linkbaseLocalDocumentsKey is not None:
                        localDocs[doc.basename].add(linkbaseLocalDocumentsKey)
                        linkbaseIdentifed = True
                if not linkbaseIdentifed:
                    localDocs[doc.basename].add(UNRECOGNIZED_LINKBASE_LOCAL_DOCUMENTS_TYPE)
        self.currentTargetReport["localDocs"] = {
            localDoc: sorted(docTypes)
            for localDoc, docTypes in localDocs.items()
        }

        # If we only process a single ZIP, add a download link to it as the
        # "filing documents" on the viewer menu.
        if self.fromSingleZIP is None:
            self.fromSingleZIP = report.modelDocument.filepath.endswith(".zip")
            if self.fromSingleZIP:
                self.filingDocZipPath = os.path.dirname(report.modelDocument.filepath)
        else:
            self.fromSingleZIP = False
        if report.fileSource.isArchive:
            filelist = report.fileSource.fs.filelist
            for file in filelist:
                directory, asset = os.path.split(file.filename)
                if "reports" in directory and asset != '' and not asset.lower().endswith(REPORT_TYPE_EXTENSIONS):
                    self.assets.append(file.filename)
            if self.assets:
                self.reportZip = report.fileSource.fs.filename

    def createViewer(
            self,
            scriptUrl: str = DEFAULT_JS_FILENAME,
            showValidations: bool = True,
            packageDownloadURL: str | None = None,
    ) -> iXBRLViewer | None:
        """
        Create an iXBRL file with XBRL data as a JSON blob, and script tags added.
        :param scriptUrl: The `src` value of the script tag that loads the viewer script.
        :param showValidations: True if validation errors should be included in output taxonomy data.
        :return: An iXBRLViewer instance that is ready to be saved.
        """

        self.taxonomyData["prefixes"] = self.nsmap.prefixmap
        self.taxonomyData["roles"] = self.roleMap.prefixmap
        if showValidations:
            self.taxonomyData["validation"] = self.validationErrors()

        if packageDownloadURL is not None:
            self.taxonomyData["filingDocuments"] = packageDownloadURL
        elif self.fromSingleZIP:
            filingDocZipName = os.path.basename(self.filingDocZipPath)
            self.iv.addFilingDoc(self.filingDocZipPath)
            self.taxonomyData["filingDocuments"] = filingDocZipName

        if not self.addViewerData(self.iv.files[0], scriptUrl):
            return None

        if len(self.iv.files) == 1:
            # If there is only a single report, call the output file "xbrlviewer.html"
            # We should probably preserve the source file extension here.
            self.iv.files[0].filename = 'xbrlviewer.html'
        if self.assets:
            self.iv.addReportAssets(self.assets)
        if self.reportZip:
            self.iv.reportZip = self.reportZip
        return self.iv


class iXBRLViewerFile:

    def __init__(self, filename, xmlDocument):
        self.filename = filename
        self.xmlDocument = deepcopy(xmlDocument)
        # deepcopy does not retain the Python proxies, so iterating the node
        # tree during serialization will create new ones. However, the original
        # ModelObjectFactory is still referenced, and that references a
        # ModelXbrl that will potentially be closed by the time we serialize.
        # Serialization only requires standard XML features, so the default
        # lxml.etree classes (and thus lookup) are fine.
        self.xmlDocument.parser.set_element_class_lookup(etree.ElementDefaultClassLookup())


class iXBRLViewer:

    def __init__(self, cntlr: Cntlr):
        self.reportZip = None
        self.filesByFilename = dict()
        self.filingDocuments = None
        self.cntlr = cntlr
        self.assets = []

    def addReportAssets(self, assets):
        self.assets.extend(assets)

    def addFile(self, ivf):
        # Overwrite previous occurrences of the same document, because it may
        # have had more IDs added to it by subsequent target documents.
        self.filesByFilename[ivf.filename] = ivf

    @property
    def files(self):
        return list(self.filesByFilename.values())

    def addFilingDoc(self, filingDocuments):
        self.filingDocuments = filingDocuments

    def save(self, destination: io.BytesIO | str, zipOutput: bool = False, copyScriptPath: Path | None = None):
        """
        Save the iXBRL viewer.
        :param destination: The target that viewer data/files will be written to (path to file/directory, or a file object itself).
        :param zipOutput: True if the destination is a zip archive.
        :param copyScriptPath: If provided, the path from where the viewer JS will be copied into the output from.
        """
        if isinstance(destination, io.BytesIO) or zipOutput: # zip output stream
            # zipfile may be cumulatively added to by inline extraction, EdgarRenderer etc
            if isinstance(destination, io.BytesIO):
                file = destination
                fileMode = 'a'
                destination = os.sep
            elif os.path.isdir(destination):
                file = os.path.join(destination, f'{os.path.splitext(os.path.basename(self.files[0].filename))[0]}.zip')
                fileMode = 'w'
            elif destination.endswith(os.sep):
                # Looks like a directory, but isn't one
                self.cntlr.addToLog("Directory %s does not exist" % destination, messageCode=ERROR_MESSAGE_CODE)
                return
            elif not os.path.isdir(os.path.dirname(os.path.abspath(destination))):
                # Directory part of filename doesn't exist
                self.cntlr.addToLog("Directory %s does not exist" % os.path.dirname(os.path.abspath(destination)), messageCode=ERROR_MESSAGE_CODE)
                return
            elif not destination.endswith('.zip'):
                # File extension isn't a zip
                self.cntlr.addToLog("File extension %s is not a zip" % os.path.splitext(destination)[0], messageCode=ERROR_MESSAGE_CODE)
                return
            else:
                file = destination
                fileMode = 'w'

            with zipfile.ZipFile(file, fileMode, zipfile.ZIP_DEFLATED, True) as zout:
                for f in self.files:
                    self.cntlr.addToLog("Saving in output zip %s" % f.filename, messageCode=INFO_MESSAGE_CODE)
                    with zout.open(f.filename, "w") as fout:
                        writer = XHTMLSerializer(fout)
                        writer.serialize(f.xmlDocument)
                if self.filingDocuments:
                    filename = os.path.basename(self.filingDocuments)
                    self.cntlr.addToLog("Writing %s" % filename, messageCode=INFO_MESSAGE_CODE)
                    zout.write(self.filingDocuments, filename)
                if copyScriptPath is not None:
                    self.cntlr.addToLog(f"Writing script from {copyScriptPath}", messageCode=INFO_MESSAGE_CODE)
                    zout.write(copyScriptPath, copyScriptPath.name)
        elif os.path.isdir(destination):
            # If output is a directory, write each file in the doc set to that
            # directory using its existing filename
            for f in self.files:
                filename = os.path.join(destination, f.filename)
                self.cntlr.addToLog("Writing %s" % filename, messageCode=INFO_MESSAGE_CODE)
                with open(filename, "wb") as fout:
                    writer = XHTMLSerializer(fout)
                    writer.serialize(f.xmlDocument)
            if self.filingDocuments:
                filename = os.path.basename(self.filingDocuments)
                self.cntlr.addToLog("Writing %s" % filename, messageCode=INFO_MESSAGE_CODE)
                shutil.copy2(self.filingDocuments, os.path.join(destination, filename))
            if self.assets:
                with zipfile.ZipFile(self.reportZip) as z:
                    for asset in self.assets:
                        fileName = os.path.basename(asset)
                        path = os.path.join(destination, fileName)
                        self.cntlr.addToLog("Writing %s" % asset, messageCode=INFO_MESSAGE_CODE)
                        with z.open(asset) as zf, open(path, 'wb') as f:
                            shutil.copyfileobj(zf, f)

            if copyScriptPath is not None:
                self._copyScript(Path(destination), copyScriptPath)
        else:
            if len(self.files) > 1:
                self.cntlr.addToLog("More than one file in input, but output is not a directory", messageCode=ERROR_MESSAGE_CODE)
            elif destination.endswith(os.sep):
                # Looks like a directory, but isn't one
                self.cntlr.addToLog("Directory %s does not exist" % destination, messageCode=ERROR_MESSAGE_CODE)
            elif not os.path.isdir(os.path.dirname(os.path.abspath(destination))):
                # Directory part of filename doesn't exist
                self.cntlr.addToLog("Directory %s does not exist" % os.path.dirname(os.path.abspath(destination)), messageCode=ERROR_MESSAGE_CODE)
            else:
                self.cntlr.addToLog("Writing %s" % destination, messageCode=INFO_MESSAGE_CODE)
                with open(destination, "wb") as fout:
                    writer = XHTMLSerializer(fout)
                    writer.serialize(self.files[0].xmlDocument)
                if self.filingDocuments:
                    filename = os.path.basename(self.filingDocuments)
                    self.cntlr.addToLog("Writing %s" % filename, messageCode=INFO_MESSAGE_CODE)
                    shutil.copy2(self.filingDocuments, os.path.join(os.path.dirname(destination), filename))
                if copyScriptPath is not None:
                    outDirectory = Path(destination).parent
                    self._copyScript(outDirectory, copyScriptPath)

    def _copyScript(self, destDirectory: Path, scriptPath: Path):
        scriptDest = destDirectory / scriptPath.name
        if scriptPath != scriptDest:
            self.cntlr.addToLog(f"Copying script from {scriptPath} to {scriptDest}.", messageCode=INFO_MESSAGE_CODE)
            shutil.copy2(scriptPath, scriptDest)
