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

from arelle import XbrlConst
from arelle.ModelDocument import Type
from arelle.ModelValue import QName, INVALIDixVALUE
from lxml import etree
import json
import math
import re
import pycountry
from arelle.ValidateXbrlCalcs import inferredDecimals
from arelle.ModelRelationshipSet import ModelRelationshipSet
from .xhtmlserialize import XHTMLSerializer

import os
import logging
import io
import zipfile
from arelle.PythonUtil import attrdict

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

class IXBRLViewerBuilder:

    def __init__(self, dts):
        self.nsmap = NamespaceMap()
        self.roleMap = NamespaceMap()
        self.dts = dts
        self.taxonomyData = {
            "concepts": {},
            "languages": {},
            "facts": {},
        }
        self.footnoteRelationshipSet = ModelRelationshipSet(dts, "XBRL-footnotes")

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
            rt = self.dts.roleTypes[elr]
            label = elr
            if len(rt) > 0:
                label = rt[0].definition
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
        if not hasattr(logHandler, "logRecordBuffer"):
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
                # XXX does not support complex units
                unit = self.nsmap.qname(f.unit.measures[0][0])
                aspects["u"] = unit
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

    def addViewerToXMLDocument(self, xmlDocument, scriptUrl):
        taxonomyDataJSON = self.escapeJSONForScriptTag(json.dumps(self.taxonomyData, indent=1, allow_nan=False))

        for child in xmlDocument.getroot():
            if child.tag == '{http://www.w3.org/1999/xhtml}body':
                child.append(etree.Comment("BEGIN IXBRL VIEWER EXTENSIONS"))

                e = etree.fromstring("<script xmlns='http://www.w3.org/1999/xhtml' type='text/javascript' />")
                e.set("src", scriptUrl)
                # Don't self close
                e.text = ''
                child.append(e)

                # Putting this in the header can interfere with character set
                # auto detection
                e = etree.fromstring("<script xmlns='http://www.w3.org/1999/xhtml' type='application/x.ixbrl-viewer+json'></script>")
                e.text = taxonomyDataJSON
                child.append(e)
                child.append(etree.Comment("END IXBRL VIEWER EXTENSIONS"))
                break

    def createViewer(self, scriptUrl="js/dist/ixbrlviewer.js", showValidations = True):
        """
        Create an iXBRL file with XBRL data as a JSON blob, and script tags added
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
            docSet = sorted(dts.modelDocument.referencesDocument.keys(), key=lambda x: x.objectIndex)
            docSetFiles = list(map(lambda x: os.path.basename(x.filepath), docSet))
            self.taxonomyData["docSetFiles"] = docSetFiles

            for n in range(0, len(docSet)):
                iv.addFile(iXBRLViewerFile(docSetFiles[n], docSet[n].xmlDocument))

            xmlDocument = docSet[0].xmlDocument 

        else:
            xmlDocument = dts.modelDocument.xmlDocument
            filename = os.path.basename(dts.modelDocument.filepath)
            iv.addFile(iXBRLViewerFile(filename, xmlDocument))

        self.addViewerToXMLDocument(xmlDocument, scriptUrl)

        return iv

class iXBRLViewerFile:

    def __init__(self, filename, xmlDocument):
        self.filename = filename
        self.xmlDocument = xmlDocument

class iXBRLViewer:

    def __init__(self, dts):
        self.files = []
        self.dts = dts

    def addFile(self, ivf):
        self.files.append(ivf)

    def save(self, outPath, outBasenameSuffix="", outzipFilePrefix=""):
        """
        Save the iXBRL viewer
        """
        if isinstance(outPath, io.BytesIO): # zip output stream
            # zipfile may be cumulatively added to by inline extraction, EdgarRenderer etc
            _outPrefix = outzipFilePrefix + ("/" if outzipFilePrefix and outzipFilePrefix[-1] not in ("/", "\\") else "")
            with zipfile.ZipFile(outPath, "a", zipfile.ZIP_DEFLATED, True) as zout:
                for f in self.files:
                    self.dts.info("viewer:info", "Saving in output zip %s" % f.filename)
                    fout = attrdict(write=lambda s: zout.writestr(_outPrefix + f.filename, s))
                    writer = XHTMLSerializer()
                    writer.serialize(f.xmlDocument, fout)
                zout.write(os.path.join(os.path.dirname(__file__), "viewer", "dist", "ixbrlviewer.js"), _outPrefix + "ixbrlviewer.js")
        elif os.path.isdir(outPath):
            # If output is a directory, write each file in the doc set to that
            # directory using its existing filename
            for f in self.files:
                filename = os.path.join(outPath, "{0[0]}{1}{0[1]}".format(os.path.splitext(f.filename), outBasenameSuffix))
                self.dts.info("viewer:info", "Writing %s" % filename)
                with open(filename, "wb") as fout:
                    writer = XHTMLSerializer()
                    writer.serialize(f.xmlDocument, fout)

        else:
            if len(self.files) > 1:
                self.dts.error("viewer:error", "More than one file in input, but output is not a directory")
            elif outPath.endswith(os.sep):
                # Looks like a directory, but isn't one
                self.dts.error("viewer:error", "Directory %s does not exist" % outPath)
            elif not os.path.isdir(os.path.dirname(os.path.abspath(outPath))):
                # Directory part of filename doesn't exist
                self.dts.error("viewer:error", "Directory %s does not exist" % os.path.dirname(os.path.abspath(outPath)))
            else:
                self.dts.info("viewer:info", "Writing %s" % outPath)
                with open("{0[0]}{1}{0[1]}".format(os.path.splitext(outPath), outBasenameSuffix), "wb") as fout:
                    writer = XHTMLSerializer()
                    writer.serialize(self.files[0].xmlDocument, fout)
