import io
import json
import logging
import os
from collections import defaultdict
from unittest.mock import Mock, patch

import pytest
from arelle import XbrlConst
from arelle.ModelDocument import Type
from arelle.ModelValue import qname
from lxml import etree

from .mock_arelle import mock_arelle

mock_arelle()

from iXBRLViewerPlugin.iXBRLViewer import NamespaceMap, IXBRLViewerBuilder, iXBRLViewerFile

class TestNamespaceMap:

    def test_getPrefix_with_none(self):
        """
        Tests NamespaceMap.getPrefix with None. Should return generated prefix.
        """
        ns_map = NamespaceMap()
        result = ns_map.getPrefix(None)
        assert result == 'ns0'

    def test_getPrefix_with_none_with_prefix(self):
        """
        Tests NamespaceMap.getPrefix with None. Should return specified prefix.
        """
        ns_map = NamespaceMap()
        prefix = 'prefix'
        result = ns_map.getPrefix(None, prefix)
        assert result == prefix

    def test_getPrefix_with_namespace(self):
        """
        Tests NamespaceMap.getPrefix for 'namespace'. Should return generated
        prefix.
        """
        ns_map = NamespaceMap()
        namespace = 'namespace'
        result = ns_map.getPrefix(namespace)
        assert result == 'ns0'

    def test_getPrefix_with_namespace_with_prefix(self):
        """
        Tests NamespaceMap.getPrefix with 'namespace' with preferred prefix.
        Should return specified prefix.
        """
        ns_map = NamespaceMap()
        namespace = 'namespace'
        prefix = 'prefix'
        result = ns_map.getPrefix(namespace, prefix)
        assert result == prefix

    def test_getPrefix_subsequent_call_with_namespace(self):
        """
        Tests NamespaceMap.getPrefix twice with 'namespace'. Should return same
        generated prefix.
        """
        ns_map = NamespaceMap()
        namespace = 'namespace'
        result = ns_map.getPrefix(namespace)
        assert result == 'ns0'
        result_2 = ns_map.getPrefix(namespace)
        assert result_2 == 'ns0'

    def test_getPrefix_subsequent_call_with_namespace_and_prefix(self):
        """
        Tests NamespaceMap.getPrefix twice with 'namespace' and specified
        prefix. Should return same specified prefix.
        """
        ns_map = NamespaceMap()
        namespace = 'namespace'
        prefix = 'prefix'
        result = ns_map.getPrefix(namespace, prefix)
        assert result == prefix
        result_2 = ns_map.getPrefix(namespace, prefix)
        assert result_2 == prefix

    def test_getPrefix_subsequent_call_with_two_namespaces_and_prefix(self):
        """
        Tests NamespaceMap.getPrefix with two namespaces.  Should return
        sequential generated prefixes.
        """
        ns_map = NamespaceMap()
        namespace_1 = 'namespace_1'
        namespace_2 = 'namespace_2'
        result = ns_map.getPrefix(namespace_1)
        assert result == 'ns0'
        result_2 = ns_map.getPrefix(namespace_2)
        assert result_2 == 'ns1'


class TestIXBRLViewer:

    def setup_method(self, method):
        self.usd_qname = Mock(
            localName='USD',
            prefix='iso4217',
            namespaceURI='http://www.xbrl.org/2003/iso4217'
        )

        self.monetary_type = Mock(
            qname = Mock(
                localName="monetaryItemType",
                prefix="xbrli",
                namespaceURI="http://www.xbrl.org/2003/instance"
            )
        )

        self.string_type = Mock(
            qname = Mock(
                localName="stringItemType",
                prefix="xbrli",
                namespaceURI="http://www.xbrl.org/2003/instance"
            )
        )

        self.integer_simple_type = Mock(
            qname = Mock(
                localName="integer",
                prefix="xs",
                namespaceURI="http://www.w3.org/2001/XMLSchema"
            )
        )

        self.usd_unit = Mock(
            measures = ([self.usd_qname],[])
        )

        self.null_units = Mock(
            measures = ([],[])
        )

        self.cash_concept = Mock(
            qname=Mock(
                localName='Cash',
                prefix='us-gaap',
                namespaceURI='http://viewer.com'
            ),
            balance="debit",
            isTypedDimension=False,
            type=self.monetary_type,
        )

        to_concept = Mock(
            qname=Mock(
                localName='to_concept',
                prefix='us-gaap',
                namespaceURI='http://viewer.com'
            ),
            balance="credit",
            isTypedDimension=False,
            type=self.monetary_type,
        )
        from_concept = Mock(
            qname=Mock(
                localName='from_concept',
                prefix='us-gaap',
                namespaceURI='http://viewer.com'
            ),
            balance=None,
            isTypedDimension=False,
            type=self.monetary_type,
        )

        dimension_concept = Mock(
            qname=Mock(
                localName='dimension',
                prefix='us-gaap',
                namespaceURI='http://viewer.com'
            ),
            balance=None,
            isTypedDimension=False,
            type=self.string_type,
        )

        typed_dimension_domain_concept = Mock(
            qname=Mock(
                localName='typed_dimension_domain',
                prefix='us-gaap',
                namespaceURI='http://viewer.com'
            ),
            balance=None,
            isTypedDimension=False,
            type=self.string_type,
        )

        typed_dimension_concept = Mock(
            qname=Mock(
                localName='typed_dimension',
                prefix='us-gaap',
                namespaceURI='http://viewer.com'
            ),
            balance=None,
            isTypedDimension=True,
            typedDomainElement=typed_dimension_domain_concept,
            type=self.integer_simple_type,
        )

        member_concept = Mock(
            qname=Mock(
                localName='member',
                prefix='us-gaap',
                namespaceURI='http://viewer.com'
            ),
            balance=None,
            isTypedDimension=False,
            type=self.string_type,
        )

        rel = Mock(
            fromModelObject=from_concept,
            toModelObject=to_concept,
            weight=1
        )

        dimension = Mock(
            dimensionQname=dimension_concept.qname,
            memberQname=member_concept.qname,
            dimension=dimension_concept,
            member=member_concept
        )

        typed_dimension = Mock(
            dimensionQname=typed_dimension_concept.qname,
            memberQname=None,
            dimension=typed_dimension_concept,
            typedMember=Mock(text='typedDimension')
        )

        dimension_missing_member = Mock(
            dimensionQname=dimension_concept.qname,
            memberQname=None,
            dimension=dimension_concept,
            typedMember=None
        )

        def isoformat_effect():
            return '01-01-19T00:00:00'

        context_1 = Mock(
            entityIdentifier=('scheme', 'ident'),
            qnameDims={'d': dimension},
            isInstantPeriod=False,
            isStartEndPeriod=True,
            startDatetime=Mock(isoformat=isoformat_effect),
            endDatetime=Mock(isoformat=isoformat_effect)
        )

        context_2 = Mock(
            entityIdentifier=('scheme', 'ident'),
            qnameDims={},
            isInstantPeriod=None,
            isStartEndPeriod=None
        )

        context_with_typed_dimension = Mock(
            entityIdentifier=('scheme', 'ident'),
            qnameDims={'d': typed_dimension},
            isInstantPeriod=False,
            isStartEndPeriod=True,
            startDatetime=Mock(isoformat=isoformat_effect),
            endDatetime=Mock(isoformat=isoformat_effect)
        )

        context_with_missing_member_on_dimension = Mock(
            entityIdentifier=('scheme', 'ident'),
            qnameDims={'d': dimension_missing_member},
            isInstantPeriod=False,
            isStartEndPeriod=True,
            startDatetime=Mock(isoformat=isoformat_effect),
            endDatetime=Mock(isoformat=isoformat_effect)
        )

        fact_1 = Mock(
            id='fact_id1',
            qname=self.cash_concept.qname,
            value=100,
            isNumeric=False,
            isTuple=False,
            context=context_1,
            concept=self.cash_concept,
            format='format'
        )

        fact_2 = Mock(
            id='fact_id2',
            qname=self.cash_concept.qname,
            concept=self.cash_concept,
            context=context_2,
            isNumeric=True,
            isTuple=False,
            unit=self.usd_unit,
            value=None,
            decimals=None,
            precision=None,
            format=None
        )

        fact_3 = Mock(
            id='fact_id3',
            qname=self.cash_concept.qname,
            concept=self.cash_concept,
            context=context_2,
            isNumeric=True,
            isTuple=False,
            unit=self.null_units,
            value=None,
            decimals=None,
            precision=None,
            format=None
        )

        fact_with_typed_dimension = Mock(
            id='fact_typed_dimension',
            qname=self.cash_concept.qname,
            value=10,
            isNumeric=False,
            isTuple=False,
            context=context_with_typed_dimension,
            concept=self.cash_concept,
            format='format'
        )

        fact_with_missing_member_on_dimension = Mock(
            id='fact_dimension_missing_member',
            qname=self.cash_concept.qname,
            value=1000,
            isNumeric=False,
            isTuple=False,
            context=context_with_missing_member_on_dimension,
            concept=self.cash_concept,
            format='format'
        )

        file_1 = Mock(
            filename='something/reports/001.jpg'
        )

        file_2 = Mock(
            filename='something/reports/002.jpg'
        )

        fs = Mock(
            filelist = [file_1, file_2]
        )

        file_source = Mock(
            fs = fs
        )

        def creationSoftwareMatches_effect(text):
            return ["Example Software Name"]

        def fromModelObjects_effect(concept):
            return []

        def relationshipSet_effect(self, *args):
            return Mock(
                fromModelObject=fromModelObjects_effect,
                modelRelationships=[rel]
            )

        def info_effect(info, msg):
            # This is a no op for logging
            pass

        baseSets = defaultdict(list)
        baseSets[('http://www.xbrl.org/2003/arcrole/summation-item', 'ELR', 'linkqname', 'arcqname')] = []
        baseSets[("http://xbrl.org/int/dim/arcrole/dimension-default", 'ELR', 'linkqname', 'arcqname')] = []
        baseSets[("http://www.xbrl.org/2003/arcrole/parent-child", 'ELR', 'linkqname', 'arcqname')] = []

        roleTypes = defaultdict(list)
        roleTypes['ELR'] = [Mock(definition = "ELR Label")]

        root = etree.Element('root')
        etree.SubElement(root, '{http://www.w3.org/1999/xhtml}body')

        self.modelDocument = Mock(
            xmlDocument=etree.ElementTree(root),
            filepath='a.html',
            referencesDocument={
                "xmlDocument":etree.ElementTree(root),
                "filepath":'a.html',
                "objectIndex":0,
                "type":Type.INLINEXBRL,
            },
            ixdsTarget=None,
        )

        self.modelDocumentInlineSet = Mock(
            referencesDocument={
                Mock(
                    xmlDocument=etree.ElementTree(root),
                    filepath='a.html',
                    objectIndex=0,
                    type=Type.INLINEXBRL,
                ): [],
                Mock(
                    xmlDocument=etree.ElementTree(root),
                    filepath='b.html',
                    objectIndex=1,
                    type=Type.INLINEXBRL,
                ): [],
                Mock(
                    xmlDocument=etree.ElementTree(root),
                    filepath='a.xsd',
                    objectIndex=2,
                    type=Type.SCHEMA,
                ): [],
            },
            filepath=self.modelDocument.filepath,
            type=Type.INLINEXBRLDOCUMENTSET,
            ixdsTarget=None,
        )


        def urlDocEntry(path, docType, linkQName=None):
            return path, Mock(
                creationSoftwareMatches=creationSoftwareMatches_effect,
                type=docType,
                basename=os.path.basename(path),
                xmlRootElement=Mock(
                    iterchildren=Mock(
                        return_value=[
                            Mock(qname=linkQName)] if linkQName else []
                    )
                )
            )

        self.modelXbrl_1 = Mock(
            relationshipSet=relationshipSet_effect,
            relationshipSets={},
            baseSets=baseSets,
            roleTypes=roleTypes,
            facts=[fact_1, fact_with_typed_dimension, fact_with_missing_member_on_dimension],
            fileSource=file_source,
            info=info_effect,
            modelDocument=self.modelDocument,
            ixdsTarget=None,
            urlDocs=dict((
                urlDocEntry('/filesystem/local-inline.htm', Type.INLINEXBRL),
                urlDocEntry('https://example.com/remote-inline.htm', Type.INLINEXBRL),
                urlDocEntry('/filesystem/local-docset/_IXDS', Type.INLINEXBRLDOCUMENTSET),
                urlDocEntry('https://example.com/remote-docset/_IXDS', Type.INLINEXBRLDOCUMENTSET),
                urlDocEntry('/filesystem/local-schema.xsd', Type.SCHEMA),
                urlDocEntry('https://example.com/remote-schema.xsd', Type.SCHEMA),
                urlDocEntry('/filesystem/local-label-linkbase.xml', Type.LINKBASE, XbrlConst.qnLinkLabelLink),
                urlDocEntry('https://example.com/remote-label-linkbase.xml', Type.LINKBASE, XbrlConst.qnLinkLabelLink),
                urlDocEntry('/filesystem/local-pres-linkbase.xml', Type.LINKBASE, XbrlConst.qnLinkPresentationLink),
                urlDocEntry('https://example.com/remote-pres-linkbase.xml', Type.LINKBASE, XbrlConst.qnLinkPresentationLink),
                urlDocEntry('/filesystem/local-calc-linkbase.xml', Type.LINKBASE, XbrlConst.qnLinkCalculationLink),
                urlDocEntry('https://example.com/remote-calc-linkbase.xml', Type.LINKBASE, XbrlConst.qnLinkCalculationLink),
                urlDocEntry('/filesystem/local-def-linkbase.xml', Type.LINKBASE, XbrlConst.qnLinkDefinitionLink),
                urlDocEntry('https://example.com/remote-def-linkbase.xml', Type.LINKBASE, XbrlConst.qnLinkDefinitionLink),
                urlDocEntry('/filesystem/local-ref-linkbase.xml', Type.LINKBASE, XbrlConst.qnLinkReferenceLink),
                urlDocEntry('https://example.com/remote-ref-linkbase.xml', Type.LINKBASE, XbrlConst.qnLinkReferenceLink),
                urlDocEntry('/filesystem/local-unrecognized-linkbase.xml', Type.LINKBASE, qname("{http://www.example.org/linkbase}link:unrecognizedLink")),
                urlDocEntry('https://example.com/remote-unrecognized-linkbase.xml', Type.LINKBASE, qname("{http://www.example.org/linkbase}link:unrecognizedLink")),
            ))
        )
        self.modelXbrl_2 = Mock(
            relationshipSet=relationshipSet_effect,
            relationshipSets={},
            baseSets=baseSets,
            roleTypes=roleTypes,
            facts=[fact_2, fact_3],
            fileSource=file_source,
            info=info_effect,
            modelDocument=self.modelDocument,
            ixdsTarget=None,
            urlDocs={}
        )
        self.modelXbrlDocSet = Mock(
            relationshipSet=relationshipSet_effect,
            relationshipSets={},
            baseSets=baseSets,
            roleTypes=roleTypes,
            facts=[fact_1, fact_with_typed_dimension, fact_with_missing_member_on_dimension],
            fileSource=file_source,
            info=info_effect,
            modelDocument=self.modelDocumentInlineSet,
            ixdsTarget=None,
            urlDocs={}
        )

        self.cash_concept.modelXbrl = self.modelXbrl_1
        to_concept.modelXbrl = self.modelXbrl_1
        from_concept.modelXbrl = self.modelXbrl_1
        dimension_concept.modelXbrl = self.modelXbrl_1
        typed_dimension_concept.modelXbrl = self.modelXbrl_1
        typed_dimension_domain_concept.modelXbrl = self.modelXbrl_1
        member_concept.modelXbrl = self.modelXbrl_1

        self.logRecordBuffer = []
        self.cntlr_mock = Mock(
            logHandler = Mock(
                logRecordBuffer = self.logRecordBuffer
            )
        )
        self.builder_1 = IXBRLViewerBuilder(self.cntlr_mock)
        self.builder_doc_set = IXBRLViewerBuilder(self.cntlr_mock)


    @patch('arelle.XbrlConst.conceptLabel', 'http://www.xbrl.org/2003/arcrole/concept-label')
    @patch('arelle.XbrlConst.conceptReference', 'http://www.xbrl.org/2003/arcrole/concept-reference')
    def test_addConcept_simple_case(self):
        builder = IXBRLViewerBuilder(Mock())
        builder.currentTargetReport = builder.newTargetReport(None)
        builder.addSourceReport()["targetReports"].append(builder.currentTargetReport)
        builder.addConcept(self.modelXbrl_1, self.cash_concept)
        assert builder.taxonomyData["sourceReports"][0]["targetReports"][0].get('concepts').get('us-gaap:Cash')

    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    def test_getRelationships_simple_case(self):
        modelXbrl = Mock(baseSets=defaultdict(list), relationshipSets={})
        builder = IXBRLViewerBuilder(Mock())
        result = builder.getRelationships(modelXbrl)
        assert result == {}

    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    def test_getRelationships_returns_a_rel(self):
        builder = IXBRLViewerBuilder(Mock())
        builder.currentTargetReport = builder.newTargetReport(None)
        result = builder.getRelationships(self.modelXbrl_1)
        roleMap = builder.roleMap
        siPrefix = roleMap.getPrefix('http://www.xbrl.org/2003/arcrole/summation-item')
        assert result.get(siPrefix).get(roleMap.getPrefix('ELR')).get('us-gaap:from_concept')

    def test_addRoleDefinition_no_definition(self):
        """
        Adding an ELR with no definition should result in no entry in the roleDefs map
        """
        elr = "http://example.com/unknownELR"
        builder = IXBRLViewerBuilder(Mock())
        builder.currentTargetReport = builder.newTargetReport(None)
        builder.addRoleDefinition(self.modelXbrl_1, elr)
        elrPrefix = builder.roleMap.getPrefix(elr)
        assert builder.currentTargetReport.get('roleDefs').get(elrPrefix) is None

    def test_addRoleDefinition_with_definition(self):
        """
        Adding an ELR with a definition should result in an "en" label with the definition as its value.
        """
        elr = "ELR"
        builder = IXBRLViewerBuilder(Mock())
        builder.currentTargetReport = builder.newTargetReport(None)
        builder.addRoleDefinition(self.modelXbrl_1, elr)
        elrPrefix = builder.roleMap.getPrefix(elr)
        assert builder.currentTargetReport.get('roleDefs').get(elrPrefix).get("en") == "ELR Label"

    @patch('arelle.XbrlConst.conceptLabel', 'http://www.xbrl.org/2003/arcrole/concept-label')
    @patch('arelle.XbrlConst.conceptReference', 'http://www.xbrl.org/2003/arcrole/concept-reference')
    @patch('arelle.XbrlConst.dimensionDefault', 'http://xbrl.org/int/dim/arcrole/dimension-default')
    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    @patch('arelle.XbrlConst.standardLabel', 'http://www.xbrl.org/2003/role/label')
    @patch('arelle.XbrlConst.documentationLabel', 'http://www.xbrl.org/2003/role/documentation')
    def test_createViewerWithValidation(self):
        js_uri = 'ixbrlviewer.js'

        error1 = logging.LogRecord("arelle", logging.ERROR, "", 0, "Error message", {}, None)    
        error1.messageCode = "code1"
        self.logRecordBuffer.append(error1)

        builder = IXBRLViewerBuilder(self.cntlr_mock)
        builder.processModel(self.modelXbrl_1)
        result = builder.createViewer(js_uri)
        assert len(result.files) == 1
        body = result.files[0].xmlDocument.getroot()[0]
        assert body[0].text == 'BEGIN IXBRL VIEWER EXTENSIONS'
        assert body[1].attrib.get('src') == js_uri
        assert body[1].attrib.get('type') == 'text/javascript'
        assert body[2].attrib.get('type') == 'application/x.ixbrl-viewer+json'
        assert body[3].text == 'END IXBRL VIEWER EXTENSIONS'

        jsdata = json.loads(body[2].text)
        errors = jsdata["validation"]
        assert errors == [{"sev": "ERROR", "msg": "Error message", "code": "code1" }]
        assert set(jsdata["sourceReports"][0]["targetReports"][0]["facts"]) == {"fact_id1", "fact_typed_dimension", "fact_dimension_missing_member"}
        assert jsdata["sourceReports"][0]["targetReports"][0]["softwareCredits"] == ["Example Software Name"]

    @patch('arelle.XbrlConst.conceptLabel', 'http://www.xbrl.org/2003/arcrole/concept-label')
    @patch('arelle.XbrlConst.conceptReference', 'http://www.xbrl.org/2003/arcrole/concept-reference')
    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    @patch('arelle.XbrlConst.standardLabel', 'http://www.xbrl.org/2003/role/label')
    @patch('arelle.XbrlConst.documentationLabel', 'http://www.xbrl.org/2003/role/documentation')
    @patch('arelle.XbrlConst.dimensionDefault', 'http://xbrl.org/int/dim/arcrole/dimension-default')
    def test_createViewer(self):
        js_uri = 'ixbrlviewer.js'
        builder = IXBRLViewerBuilder(self.cntlr_mock)
        builder.processModel(self.modelXbrl_1)
        result = builder.createViewer(js_uri, showValidations = False)
        assert len(result.files) == 1
        body = result.files[0].xmlDocument.getroot()[0]
        assert body[0].text, 'BEGIN IXBRL VIEWER EXTENSIONS'
        assert body[1].attrib.get('src') == js_uri
        assert body[1].attrib.get('type') == 'text/javascript'
        assert body[2].attrib.get('type') == 'application/x.ixbrl-viewer+json'
        assert body[3].text == 'END IXBRL VIEWER EXTENSIONS'

        jsdata = json.loads(body[2].text)
        assert "validation" not in jsdata
        reportData = jsdata["sourceReports"][0]["targetReports"][0]
        assert set(reportData["facts"]) == {"fact_id1", "fact_typed_dimension", "fact_dimension_missing_member"}
        assert reportData["concepts"] == {
            'us-gaap:Cash': {'e': True, 't': True, 'labels': {}, 'dt': 'xbrli:monetaryItemType', 'b': 'debit'},
            'us-gaap:from_concept': {'e': True, 't': True, 'labels': {}, 'dt': 'xbrli:monetaryItemType'},
            'us-gaap:to_concept': {'e': True, 't': True, 'labels': {}, 'dt': 'xbrli:monetaryItemType', 'b': 'credit'},
            'us-gaap:dimension': {'d': 'e', 'e': True, 't': True, 'labels': {}, 'dt': 'xbrli:stringItemType'},
            'us-gaap:member': {'e': True, 't': True, 'labels': {}, 'dt': 'xbrli:stringItemType'},
            'us-gaap:typed_dimension_domain': {'e': True, 't': True, 'labels': {}, 'dt': 'xbrli:stringItemType'},
            'us-gaap:typed_dimension': {'d': 't', 'e': True, 't': True, 'labels': {}, 'td': 'us-gaap:typed_dimension_domain', 'dt': 'xs:integer'},
        }
        assert reportData["localDocs"] == {
            'local-inline.htm': ['inline'],
            'local-schema.xsd': ['schema'],
            'local-pres-linkbase.xml': ['presLinkbase'],
            'local-calc-linkbase.xml': ['calcLinkbase'],
            'local-def-linkbase.xml': ['defLinkbase'],
            'local-label-linkbase.xml': ['labelLinkbase'],
            'local-ref-linkbase.xml': ['refLinkbase'],
            'local-unrecognized-linkbase.xml': ['unrecognizedLinkbase'],
        }

        assert jsdata["sourceReports"][0]["docSetFiles"] == ["a.html"]

    @patch('arelle.XbrlConst.conceptLabel', 'http://www.xbrl.org/2003/arcrole/concept-label')
    @patch('arelle.XbrlConst.conceptReference', 'http://www.xbrl.org/2003/arcrole/concept-reference')
    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    @patch('arelle.XbrlConst.standardLabel', 'http://www.xbrl.org/2003/role/label')
    @patch('arelle.XbrlConst.documentationLabel', 'http://www.xbrl.org/2003/role/documentation')
    @patch('arelle.XbrlConst.dimensionDefault', 'http://xbrl.org/int/dim/arcrole/dimension-default')
    def test_createStubViewer(self):
        js_uri = 'ixbrlviewer.js'
        builder = IXBRLViewerBuilder(self.cntlr_mock, useStubViewer = True)
        builder.processModel(self.modelXbrl_1)
        result = builder.createViewer(js_uri, showValidations = False)
        assert len(result.files) == 2
        body = result.files[0].xmlDocument.getroot().find('{http://www.w3.org/1999/xhtml}body')
        assert body[0].text == 'BEGIN IXBRL VIEWER EXTENSIONS'
        assert body[1].attrib.get('src') == js_uri
        assert body[1].attrib.get('type') == 'text/javascript'
        assert body[2].attrib.get('type') == 'application/x.ixbrl-viewer+json'
        assert body[3].text == 'END IXBRL VIEWER EXTENSIONS'

        jsdata = json.loads(body[2].text)
        assert "validation" not in jsdata
        reportData = jsdata["sourceReports"][0]["targetReports"][0]
        assert set(reportData["facts"]) == {"fact_id1", "fact_typed_dimension", "fact_dimension_missing_member"}
        assert reportData["concepts"] == {
            'us-gaap:Cash': {'e': True, 't': True, 'labels': {}, 'dt': 'xbrli:monetaryItemType', 'b': 'debit'},
            'us-gaap:from_concept': {'e': True, 't': True, 'labels': {}, 'dt': 'xbrli:monetaryItemType'},
            'us-gaap:to_concept': {'e': True, 't': True, 'labels': {}, 'dt': 'xbrli:monetaryItemType', 'b': 'credit'},
            'us-gaap:dimension': {'d': 'e', 'e': True, 't': True, 'labels': {}, 'dt': 'xbrli:stringItemType'},
            'us-gaap:member': {'e': True, 't': True, 'labels': {}, 'dt': 'xbrli:stringItemType'},
            'us-gaap:typed_dimension_domain': {'e': True, 't': True, 'labels': {}, 'dt': 'xbrli:stringItemType'},
            'us-gaap:typed_dimension': {'d': 't', 'e': True, 't': True, 'labels': {}, 'td': 'us-gaap:typed_dimension_domain', 'dt': 'xs:integer'},
        }
        assert reportData["localDocs"] == {
            'local-inline.htm': ['inline'],
            'local-schema.xsd': ['schema'],
            'local-pres-linkbase.xml': ['presLinkbase'],
            'local-calc-linkbase.xml': ['calcLinkbase'],
            'local-def-linkbase.xml': ['defLinkbase'],
            'local-label-linkbase.xml': ['labelLinkbase'],
            'local-ref-linkbase.xml': ['refLinkbase'],
            'local-unrecognized-linkbase.xml': ['unrecognizedLinkbase'],
        }

        assert jsdata["sourceReports"][0]["docSetFiles"] == [ "a.html" ]

    @patch('arelle.XbrlConst.conceptLabel', 'http://www.xbrl.org/2003/arcrole/concept-label')
    @patch('arelle.XbrlConst.conceptReference', 'http://www.xbrl.org/2003/arcrole/concept-reference')
    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    @patch('arelle.XbrlConst.standardLabel', 'http://www.xbrl.org/2003/role/label')
    @patch('arelle.XbrlConst.documentationLabel', 'http://www.xbrl.org/2003/role/documentation')
    @patch('arelle.XbrlConst.dimensionDefault', 'http://xbrl.org/int/dim/arcrole/dimension-default')
    def test_createViewer_docset(self):
        js_uri = 'ixbrlviewer.js'
        self.builder_doc_set.processModel(self.modelXbrlDocSet)
        result = self.builder_doc_set.createViewer(js_uri, showValidations=False)
        assert len(result.files) == 2
        body = result.files[0].xmlDocument.getroot()[0]
        assert body[0].text == 'BEGIN IXBRL VIEWER EXTENSIONS'
        assert body[1].attrib.get('src') == js_uri
        assert body[1].attrib.get('type') == 'text/javascript'
        assert body[2].attrib.get('type') == 'application/x.ixbrl-viewer+json'
        assert body[3].text == 'END IXBRL VIEWER EXTENSIONS'

        jsdata = json.loads(body[2].text)
        assert "validation" not in jsdata
        reportData = jsdata["sourceReports"][0]["targetReports"][0]
        assert set(reportData["facts"]) == {"fact_id1", "fact_typed_dimension", "fact_dimension_missing_member"}

        assert jsdata["sourceReports"][0]["docSetFiles"] == [
            'a.html',
            'b.html'
        ]

    @patch('arelle.XbrlConst.conceptLabel', 'http://www.xbrl.org/2003/arcrole/concept-label')
    @patch('arelle.XbrlConst.conceptReference', 'http://www.xbrl.org/2003/arcrole/concept-reference')
    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.dimensionDefault', 'http://xbrl.org/int/dim/arcrole/dimension-default')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    @patch('arelle.XbrlConst.standardLabel', 'http://www.xbrl.org/2003/role/label')
    @patch('arelle.XbrlConst.documentationLabel', 'http://www.xbrl.org/2003/role/documentation')
    def test_createViewer_bad_path(self):
        js_uri = 'ixbrlviewer.js'
        builder = IXBRLViewerBuilder(self.cntlr_mock)
        builder.processModel(self.modelXbrl_2)
        result = builder.createViewer(js_uri)
        assert len(result.files) == 1
        body = result.files[0].xmlDocument.getroot()[0]
        assert body[0].text == 'BEGIN IXBRL VIEWER EXTENSIONS'
        assert body[1].tag == '{http://www.w3.org/1999/xhtml}script'
        assert body[1].prefix is None
        assert body[1].attrib.get('src') == js_uri
        assert body[1].attrib.get('type') == 'text/javascript'
        assert body[2].tag == '{http://www.w3.org/1999/xhtml}script'
        assert body[2].prefix is None
        assert body[2].attrib.get('type') == 'application/x.ixbrl-viewer+json'
        assert body[3].text == 'END IXBRL VIEWER EXTENSIONS'

        jsdata = json.loads(body[2].text)
        facts = jsdata["sourceReports"][0]["targetReports"][0]["facts"]
        assert facts.keys() == {"fact_id2", "fact_id3"}
        assert facts["fact_id2"]["a"]["u"] == "iso4217:USD"
        assert facts["fact_id3"]["a"]["u"] is None

    def test_enableFeature_valid(self):
        """
        Enable a defined feature
        """
        builder = IXBRLViewerBuilder(Mock(), features={'review': True})
        assert builder.taxonomyData["features"] == {'review': True}

    def test_enableFeature_invalid(self):
        """
        Attempt to enable an undefined feature
        """
        with pytest.raises(AssertionError, match=rf'^Given feature name `unknown` does not match any defined features'):
            IXBRLViewerBuilder(Mock(), features={'unknown': True})

    def test_xhtmlNamespaceHandling(self):
        # Check the prefix used for our inserted script tags
        tests = (rb'''
            <html xmlns="http://www.w3.org/1999/xhtml">
                <body>
                </body>
            </html>
        ''',
        rb'''
            <html xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/1999/xhtml">
                <body>
                </body>
            </html>
        ''',
        # In this case we won't fix the root element to be in the default NS,
        # but our <script> tags will be.
        rb'''
            <xhtml:html xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/1999/xhtml">
                <body>
                </body>
            </xhtml:html>
        '''
        )

        for xmls in tests:
            xml = etree.parse(io.BytesIO(xmls))

            js_uri = 'https://example.com/script-url'
            viewer_file = iXBRLViewerFile("test.xhtml", xml)
            result = self.builder_1.addViewerData(viewer_file, js_uri)

            # addViewerData takes a copy, so original body tag should be empty
            original_body = xml.getroot()[0]
            assert len(original_body) == 0

            body = viewer_file.xmlDocument.getroot()[0]
            assert len(body) == 4
            assert body[0].text == 'BEGIN IXBRL VIEWER EXTENSIONS'
            assert body[1].tag == '{http://www.w3.org/1999/xhtml}script'
            assert body[1].prefix is None
            assert body[1].attrib.get('src') == js_uri
            assert body[1].attrib.get('type') == 'text/javascript'
            assert body[2].tag == '{http://www.w3.org/1999/xhtml}script'
            assert body[2].prefix is None
            assert body[2].attrib.get('type') == 'application/x.ixbrl-viewer+json'
            assert body[3].text == 'END IXBRL VIEWER EXTENSIONS'
