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
from typing import Optional, Union

import pycountry
from arelle import ModelXbrl, XbrlConst
from arelle.ModelDocument import Type
from arelle.ModelRelationshipSet import ModelRelationshipSet
from arelle.ModelValue import QName, INVALIDixVALUE
from arelle.UrlUtil import isHttpUrl
from arelle.ValidateXbrlCalcs import inferredDecimals
from lxml import etree

from iXBRLViewerPlugin.constants import DEFAULT_VIEWER_PATH
from .xhtmlserialize import XHTMLSerializer


UNRECOGNIZED_LINKBASE_LOCAL_DOCUMENTS_TYPE = 'unrecognizedLinkbase'
LINK_QNAME_TO_LOCAL_DOCUMENTS_LINKBASE_TYPE = {
    XbrlConst.qnLinkCalculationLink: 'calcLinkbase',
    XbrlConst.qnLinkDefinitionLink: 'defLinkbase',
    XbrlConst.qnLinkLabelLink: 'labelLinkbase',
    XbrlConst.qnLinkPresentationLink: 'presLinkbase',
    XbrlConst.qnLinkReferenceLink: 'refLinkbase',
}

WIDER_NARROWER_ARCROLE = 'http://www.esma.europa.eu/xbrl/esef/arcrole/wider-narrower'

VIEWER_FEATURES_AND_DESCRIPTIONS = {
    "review": "Enables highlighting of untagged numbers and dates.",
}

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

class IXBRLViewerBuilder:

    def __init__(self, dts: ModelXbrl, basenameSuffix: str = ''):
        self.nsmap = NamespaceMap()
        self.roleMap = NamespaceMap()
        self.dts = dts
        self.taxonomyData = {
            "concepts": {},
            "languages": {},
            "facts": {},
            "features": [],
        }
        self.footnoteRelationshipSet = ModelRelationshipSet(dts, "XBRL-footnotes")
        self.basenameSuffix = basenameSuffix

    def enableFeature(self, featureName: str):
        if featureName in self.taxonomyData["features"]:
            return
        assert featureName in VIEWER_FEATURES_AND_DESCRIPTIONS, \
            f'Given feature name `{featureName}` does not match any defined features: {VIEWER_FEATURES_AND_DESCRIPTIONS.keys()}'
        self.taxonomyData["features"].append(featureName)

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

    def makeLanguageName(self, langCode):
        code = re.sub("-.*","",langCode)
        try:
            language = pycountry.languages.lookup(code)
            match = re.match(r'^[^-]+-(.*)$',langCode)
            name = language.name
            if match is not None:
                name = "%s (%s)" % (name, match.group(1).upper())
        except LookupError:
            name = langCode

        return name

    def addLanguage(self, langCode):
        if langCode not in self.taxonomyData["languages"]:
            self.taxonomyData["languages"][langCode] = self.makeLanguageName(langCode)
            
    def addELR(self, elr):
        prefix = self.roleMap.getPrefix(elr)
        if self.taxonomyData.setdefault("roleDefs",{}).get(prefix, None) is None:
            rts = self.dts.roleTypes.get(elr, [])
            label = next((rt.definition for rt in rts if rt.definition is not None), None)
            if label is not None:
                self.taxonomyData["roleDefs"].setdefault(prefix,{})["en"] = label

    def addConcept(self, concept, dimensionType = None):
        if concept is None:
            return
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
                self.addLanguage(l.xmlLang.lower());

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

            if concept.type is not None and concept.type.isTextBlock:
                conceptData['t'] = True

            if concept.isTypedDimension:
                typedDomainElement = concept.typedDomainElement
                if typedDomainElement is not None:
                    typedDomainName = self.nsmap.qname(typedDomainElement.qname)
                    conceptData['td'] = typedDomainName
                    self.addConcept(typedDomainElement)

            self.taxonomyData["concepts"][conceptName] = conceptData

    def treeWalk(self, rels, item, indent = 0):
        for r in rels.fromModelObject(item):
            if r.toModelObject is not None:
                self.treeWalk(rels, r.toModelObject, indent + 1)

    def getRelationships(self):
        rels = {}

        for baseSetKey, baseSetModelLinks  in self.dts.baseSets.items():
            arcrole, ELR, linkqname, arcqname = baseSetKey
            if arcrole in (XbrlConst.summationItem, WIDER_NARROWER_ARCROLE, XbrlConst.parentChild, XbrlConst.dimensionDefault) and ELR is not None:
                self.addELR(ELR)
                rr = dict()
                relSet = self.dts.relationshipSet(arcrole, ELR)
                for r in relSet.modelRelationships:
                    if r.fromModelObject is not None and r.toModelObject is not None:
                        fromKey = self.nsmap.qname(r.fromModelObject.qname)
                        rel = {
                            "t": self.nsmap.qname(r.toModelObject.qname),
                        }
                        if r.weight is not None:
                            rel['w'] = r.weight
                        rr.setdefault(fromKey, []).append(rel)
                        self.addConcept(r.toModelObject)
                        self.addConcept(r.fromModelObject)

                rels.setdefault(self.roleMap.getPrefix(arcrole),{})[self.roleMap.getPrefix(ELR)] = rr
        return rels

    def validationErrors(self):
        dts = self.dts

        logHandler = dts.modelManager.cntlr.logHandler
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

    def addFact(self, f):
        if f.id is None:
            f.set("id","ixv-%d" % (self.idGen))

        self.idGen += 1
        conceptName = self.nsmap.qname(f.qname)
        scheme, ident = f.context.entityIdentifier

        aspects = {
            "c": conceptName,
            "e": self.nsmap.qname(QName(self.nsmap.getPrefix(scheme,"e"), scheme, ident)),
        }

        factData = {
            "a": aspects,
        }

        if f.isNil:
            factData["v"] = None
        elif f.concept is not None and f.concept.isEnumeration:
            qnEnums = f.xValue
            if not isinstance(qnEnums, list):
                qnEnums = (qnEnums,)
            factData["v"] = " ".join(self.nsmap.qname(qn) for qn in qnEnums)
            for qn in qnEnums:
                self.addConcept(self.dts.qnameConcepts.get(qn))
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
                self.addConcept(v.member)
                self.addConcept(v.dimension, dimensionType = "e")
            elif v.typedMember is not None:
                aspects[self.nsmap.qname(v.dimensionQname)] = v.typedMember.text
                self.addConcept(v.dimension, dimensionType = "t")

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

        self.taxonomyData["facts"][f.id] = factData
        self.addConcept(f.concept)

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

    def addViewerToXMLDocument(self, xmlDocument, scriptUrl):
        taxonomyDataJSON = self.escapeJSONForScriptTag(json.dumps(self.taxonomyData, indent=1, allow_nan=False))

        for child in xmlDocument.getroot():
            if child.tag == '{http://www.w3.org/1999/xhtml}body':
                for body_child in child:
                    if body_child.tag == '{http://www.w3.org/1999/xhtml}script' and body_child.get('type','') == 'application/x.ixbrl-viewer+json':
                        self.dts.error("viewer:error", "File already contains iXBRL viewer")
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

    def createViewer(self, scriptUrl: str = DEFAULT_VIEWER_PATH, useStubViewer: bool = False, showValidations: bool = True, packageDownloadURL: str = None) -> Optional[iXBRLViewer]:
        """
        Create an iXBRL file with XBRL data as a JSON blob, and script tags added.
        :param scriptUrl: The `src` value of the script tag that loads the viewer script.
        :param useStubViewer: True if stub document should be included in output.
        :param showValidations: True if validation errors should be included in output taxonomy data.
        :return: An iXBRLViewer instance that is ready to be saved.
        """
        dts = self.dts
        iv = iXBRLViewer(dts)
        self.idGen = 0
        self.roleMap.getPrefix(XbrlConst.standardLabel, "std")
        self.roleMap.getPrefix(XbrlConst.documentationLabel, "doc")
        self.roleMap.getPrefix(XbrlConst.summationItem, "calc")
        self.roleMap.getPrefix(XbrlConst.parentChild, "pres")
        self.roleMap.getPrefix(XbrlConst.dimensionDefault, "d-d")
        self.roleMap.getPrefix(WIDER_NARROWER_ARCROLE, "w-n")

        docSetFiles = None

        for f in dts.facts:
            self.addFact(f)

        self.taxonomyData["prefixes"] = self.nsmap.prefixmap
        self.taxonomyData["roles"] = self.roleMap.prefixmap
        self.taxonomyData["rels"] = self.getRelationships()

        if showValidations:
            self.taxonomyData["validation"] = self.validationErrors()

        dts.info("viewer:info", "Creating iXBRL viewer")
        if dts.modelDocument.type == Type.INLINEXBRLDOCUMENTSET:
            # Sort by object index to preserve order in which files were specified.
            xmlDocsByFilename = {
                os.path.basename(self.outputFilename(doc.filepath)): deepcopy(doc.xmlDocument)
                for doc in sorted(dts.modelDocument.referencesDocument.keys(), key=lambda x: x.objectIndex)
            }
            docSetFiles = list(xmlDocsByFilename.keys())

            if useStubViewer:
                xmlDocument = self.getStubDocument()
                iv.addFile(iXBRLViewerFile("ixbrlviewer.html", xmlDocument))
            else:
                xmlDocument = next(iter(xmlDocsByFilename.values()))

            for filename, docSetXMLDoc in xmlDocsByFilename.items():
                iv.addFile(iXBRLViewerFile(filename, docSetXMLDoc))

        elif useStubViewer:
            xmlDocument = self.getStubDocument()
            filename = self.outputFilename(os.path.basename(dts.modelDocument.filepath))
            docSetFiles = [ filename ]
            iv.addFile(iXBRLViewerFile("ixbrlviewer.html", xmlDocument))
            iv.addFile(iXBRLViewerFile(filename, dts.modelDocument.xmlDocument))

        else:
            xmlDocument = deepcopy(dts.modelDocument.xmlDocument)
            iv.addFile(iXBRLViewerFile('xbrlviewer.html', xmlDocument))

        if packageDownloadURL is not None:
            self.taxonomyData["filingDocuments"] = packageDownloadURL
        elif os.path.dirname(self.dts.modelDocument.filepath).endswith('.zip'):
            filingDocZipPath = os.path.dirname(self.dts.modelDocument.filepath)
            filingDocZipName = os.path.basename(filingDocZipPath)
            iv.addFilingDoc(filingDocZipPath)
            self.taxonomyData["filingDocuments"] = filingDocZipName

        localDocs = defaultdict(set)
        for path, doc in dts.urlDocs.items():
            if isHttpUrl(path):
                continue
            if doc.type in (Type.INLINEXBRL, Type.INLINEXBRLDOCUMENTSET):
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
        self.taxonomyData["localDocs"] = {
            localDoc: sorted(docTypes)
            for localDoc, docTypes in localDocs.items()
        }

        if docSetFiles is not None:
            self.taxonomyData["docSetFiles"] = list(urllib.parse.quote(f) for f in docSetFiles)

        if not self.addViewerToXMLDocument(xmlDocument, scriptUrl):
            return None

        return iv


class iXBRLViewerFile:

    def __init__(self, filename, xmlDocument):
        self.filename = filename
        self.xmlDocument = xmlDocument


class iXBRLViewer:

    def __init__(self, dts):
        self.files = []
        self.filingDocuments = None
        self.dts = dts
    def addFile(self, ivf):
        self.files.append(ivf)

    def addFilingDoc(self, filingDocuments):
        self.filingDocuments = filingDocuments

    def save(self, destination: Union[io.BytesIO, str], zipOutput: bool = False, copyScriptPath: Optional[str] = None):
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
                self.dts.error("viewer:error", "Directory %s does not exist" % destination)
                return
            elif not os.path.isdir(os.path.dirname(os.path.abspath(destination))):
                # Directory part of filename doesn't exist
                self.dts.error("viewer:error", "Directory %s does not exist" % os.path.dirname(os.path.abspath(destination)))
                return
            elif not destination.endswith('.zip'):
                # File extension isn't a zip
                self.dts.error("viewer:error", "File extension %s is not a zip" % os.path.splitext(destination)[0])
                return
            else:
                file = destination
                fileMode = 'w'

            with zipfile.ZipFile(file, fileMode, zipfile.ZIP_DEFLATED, True) as zout:
                for f in self.files:
                    self.dts.info("viewer:info", "Saving in output zip %s" % f.filename)
                    with zout.open(f.filename, "w") as fout:
                        writer = XHTMLSerializer(fout)
                        writer.serialize(f.xmlDocument)
                if self.filingDocuments:
                    filename = os.path.basename(self.filingDocuments)
                    self.dts.info("viewer:info", "Writing %s" % filename)
                    zout.write(self.filingDocuments, filename)
                if copyScriptPath is not None:
                    scriptSrc = os.path.join(destination, copyScriptPath)
                    self.dts.info("viewer:info", "Writing script from %s" % scriptSrc)
                    zout.write(scriptSrc, os.path.basename(copyScriptPath))
        elif os.path.isdir(destination):
            # If output is a directory, write each file in the doc set to that
            # directory using its existing filename
            for f in self.files:
                filename = os.path.join(destination, f.filename)
                self.dts.info("viewer:info", "Writing %s" % filename)
                with open(filename, "wb") as fout:
                    writer = XHTMLSerializer(fout)
                    writer.serialize(f.xmlDocument)
            if self.filingDocuments:
                filename = os.path.basename(self.filingDocuments)
                self.dts.info("viewer:info", "Writing %s" % filename)
                shutil.copy2(self.filingDocuments, os.path.join(destination, filename))
            if copyScriptPath is not None:
                self._copyScript(destination, copyScriptPath)
        else:
            if len(self.files) > 1:
                self.dts.error("viewer:error", "More than one file in input, but output is not a directory")
            elif destination.endswith(os.sep):
                # Looks like a directory, but isn't one
                self.dts.error("viewer:error", "Directory %s does not exist" % destination)
            elif not os.path.isdir(os.path.dirname(os.path.abspath(destination))):
                # Directory part of filename doesn't exist
                self.dts.error("viewer:error", "Directory %s does not exist" % os.path.dirname(os.path.abspath(destination)))
            else:
                self.dts.info("viewer:info", "Writing %s" % destination)
                with open(destination, "wb") as fout:
                    writer = XHTMLSerializer(fout)
                    writer.serialize(self.files[0].xmlDocument)
                if self.filingDocuments:
                    filename = os.path.basename(self.filingDocuments)
                    self.dts.info("viewer:info", "Writing %s" % filename)
                    shutil.copy2(self.filingDocuments, os.path.join(os.path.dirname(destination), filename))
                if copyScriptPath is not None:
                    outDirectory = os.path.dirname(os.path.join(os.getcwd(), destination))
                    self._copyScript(outDirectory, copyScriptPath)

    def _copyScript(self, directory: str, scriptPath: str):
        scriptSrc = os.path.join(directory, scriptPath)
        scriptDest = os.path.join(directory, os.path.basename(scriptPath))
        self.dts.info("viewer:info", "Copying script from %s to %s" % (scriptSrc, scriptDest))
        shutil.copy2(scriptSrc, scriptDest)
