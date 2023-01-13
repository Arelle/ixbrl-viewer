import unittest
import json
import logging
from io import StringIO
from collections import defaultdict
from lxml import etree
from unittest.mock import Mock, patch
from .mock_arelle import mock_arelle

mock_arelle()

from iXBRLViewerPlugin.iXBRLViewer import NamespaceMap, IXBRLViewerBuilder

class TestNamespaceMap(unittest.TestCase):

    def test_getPrefix_with_none(self):
        """
        Tests NamespaceMap.getPrefix with None. Should return generated prefix.
        """
        ns_map = NamespaceMap()
        result = ns_map.getPrefix(None)
        self.assertEqual(result, 'ns0')

    def test_getPrefix_with_none_with_prefix(self):
        """
        Tests NamespaceMap.getPrefix with None. Should return specified prefix.
        """
        ns_map = NamespaceMap()
        prefix = 'prefix'
        result = ns_map.getPrefix(None, prefix)
        self.assertEqual(result, prefix)

    def test_getPrefix_with_namespace(self):
        """
        Tests NamespaceMap.getPrefix for 'namespace'. Should return generated
        prefix.
        """
        ns_map = NamespaceMap()
        namespace = 'namespace'
        result = ns_map.getPrefix(namespace)
        self.assertEqual(result, 'ns0')

    def test_getPrefix_with_namespace_with_prefix(self):
        """
        Tests NamespaceMap.getPrefix with 'namespace' with preferred prefix.
        Should return specified prefix.
        """
        ns_map = NamespaceMap()
        namespace = 'namespace'
        prefix = 'prefix'
        result = ns_map.getPrefix(namespace, prefix)
        self.assertEqual(result, prefix)

    def test_getPrefix_subsequent_call_with_namespace(self):
        """
        Tests NamespaceMap.getPrefix twice with 'namespace'. Should return same
        generated prefix.
        """
        ns_map = NamespaceMap()
        namespace = 'namespace'
        result = ns_map.getPrefix(namespace)
        self.assertEqual(result, 'ns0')
        result_2 = ns_map.getPrefix(namespace)
        self.assertEqual(result_2, 'ns0')

    def test_getPrefix_subsequent_call_with_namespace_and_prefix(self):
        """
        Tests NamespaceMap.getPrefix twice with 'namespace' and specified
        prefix. Should return same specified prefix.
        """
        ns_map = NamespaceMap()
        namespace = 'namespace'
        prefix = 'prefix'
        result = ns_map.getPrefix(namespace, prefix)
        self.assertEqual(result, prefix)
        result_2 = ns_map.getPrefix(namespace, prefix)
        self.assertEqual(result_2, prefix)

    def test_getPrefix_subsequent_call_with_two_namespaces_and_prefix(self):
        """
        Tests NamespaceMap.getPrefix with two namespaces.  Should return
        sequential generated prefixes.
        """
        ns_map = NamespaceMap()
        namespace_1 = 'namespace_1'
        namespace_2 = 'namespace_2'
        result = ns_map.getPrefix(namespace_1)
        self.assertEqual(result, 'ns0')
        result_2 = ns_map.getPrefix(namespace_2)
        self.assertEqual(result_2, 'ns1')


class TestIXBRLViewer(unittest.TestCase):

    def setUp(self):
        self.usd_qname = Mock(
            localName='USD',
            prefix='iso4217',
            namespaceURI='http://www.xbrl.org/2003/iso4217'
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
            )
        )

        to_concept = Mock(
            qname=Mock(
                localName='to_concept',
                prefix='us-gaap',
                namespaceURI='http://viewer.com'
            )
        )
        from_concept = Mock(
            qname=Mock(
                localName='from_concept',
                prefix='us-gaap',
                namespaceURI='http://viewer.com'
            )
        )

        dimension_concept = Mock(
            qname=Mock(
                localName='dimension',
                prefix='us-gaap',
                namespaceURI='http://viewer.com'
            )
        )

        member_concept = Mock(
            qname=Mock(
                localName='member',
                prefix='us-gaap',
                namespaceURI='http://viewer.com'
            )
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
            dimensionQname=dimension_concept.qname,
            memberQname=None,
            dimension=dimension_concept,
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
            context=context_with_typed_dimension,
            concept=self.cash_concept,
            format='format'
        )

        fact_with_missing_member_on_dimension = Mock(
            id='fact_dimension_missing_member',
            qname=self.cash_concept.qname,
            value=1000,
            isNumeric=False,
            context=context_with_missing_member_on_dimension,
            concept=self.cash_concept,
            format='format'
        )

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
            filepath=''
        )

        error1 = logging.LogRecord("arelle", logging.ERROR, "", 0, "Error message", {}, None)    
        error1.messageCode = "code1"
        self.modelManager = Mock(
            cntlr = Mock(
                logHandler = Mock (
                    logRecordBuffer = [
                        error1
                    ]
                )
            )
        )

        self.modelXbrl_1 = Mock(
            relationshipSet=relationshipSet_effect,
            relationshipSets={},
            baseSets=baseSets,
            roleTypes=roleTypes,
            facts=[fact_1, fact_with_typed_dimension, fact_with_missing_member_on_dimension],
            info=info_effect,
            modelDocument=self.modelDocument,
            modelManager = self.modelManager
        )
        self.modelXbrl_2 = Mock(
            relationshipSet=relationshipSet_effect,
            relationshipSets={},
            baseSets=baseSets,
            roleTypes=roleTypes,
            facts=[fact_2, fact_3],
            info=info_effect,
            modelDocument=self.modelDocument,
            modelManager = self.modelManager
        )

        self.cash_concept.modelXbrl = self.modelXbrl_1
        to_concept.modelXbrl = self.modelXbrl_1
        from_concept.modelXbrl = self.modelXbrl_1
        dimension_concept.modelXbrl = self.modelXbrl_1
        member_concept.modelXbrl = self.modelXbrl_1
        self.builder_1 = IXBRLViewerBuilder(self.modelXbrl_1)
        self.builder_2 = IXBRLViewerBuilder(self.modelXbrl_1)
        self.builder_3 = IXBRLViewerBuilder(self.modelXbrl_2)

    @patch('arelle.XbrlConst.conceptLabel', 'http://www.xbrl.org/2003/arcrole/concept-label')
    @patch('arelle.XbrlConst.conceptReference', 'http://www.xbrl.org/2003/arcrole/concept-reference')
    def test_addConcept_simple_case(self):
        self.builder_1.addConcept(self.cash_concept)
        self.assertTrue(self.builder_1.taxonomyData.get('concepts').get('us-gaap:Cash'))

    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    def test_getRelationships_simple_case(self):
        modelXbrl = Mock(baseSets=defaultdict(list), relationshipSets={})
        builder = IXBRLViewerBuilder(modelXbrl)
        result = builder.getRelationships()
        self.assertDictEqual(result, {})

    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    def test_getRelationships_returns_a_rel(self):
        result = self.builder_1.getRelationships()
        roleMap = self.builder_1.roleMap
        siPrefix = roleMap.getPrefix('http://www.xbrl.org/2003/arcrole/summation-item')
        self.assertTrue(result.get(siPrefix).get(roleMap.getPrefix('ELR')).get('us-gaap:from_concept'))

    def test_addELR_no_definition(self):
        """
        Adding an ELR with no definition should result in no entry in the roleDefs map
        """
        elr = "http://example.com/unknownELR"
        self.builder_1.addELR(elr)
        elrPrefix = self.builder_1.roleMap.getPrefix(elr)
        self.assertEqual(self.builder_1.taxonomyData.get('roleDefs').get(elrPrefix), None)

    def test_addELR_with_definition(self):
        """
        Adding an ELR with a definition should result in an "en" label with the definition as its value.
        """
        elr = "ELR"
        self.builder_1.addELR(elr)
        elrPrefix = self.builder_1.roleMap.getPrefix(elr)
        self.assertEqual(self.builder_1.taxonomyData.get('roleDefs').get(elrPrefix).get("en"), "ELR Label")

    @patch('arelle.XbrlConst.conceptLabel', 'http://www.xbrl.org/2003/arcrole/concept-label')
    @patch('arelle.XbrlConst.conceptReference', 'http://www.xbrl.org/2003/arcrole/concept-reference')
    @patch('arelle.XbrlConst.dimensionDefault', 'http://xbrl.org/int/dim/arcrole/dimension-default')
    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    @patch('arelle.XbrlConst.standardLabel', 'http://www.xbrl.org/2003/role/label')
    @patch('arelle.XbrlConst.documentationLabel', 'http://www.xbrl.org/2003/role/documentation')
    def test_createViewerWithValidation(self):
        js_uri = 'ixbrlviewer.js'
        result = self.builder_1.createViewer(js_uri)
        self.assertEqual(len(result.files),1)
        body = result.files[0].xmlDocument.getroot()[0]
        self.assertEqual(body[0].text, 'BEGIN IXBRL VIEWER EXTENSIONS')
        self.assertEqual(body[1].attrib.get('src'), js_uri)
        self.assertEqual(body[1].attrib.get('type'), 'text/javascript')
        self.assertEqual(body[2].attrib.get('type'), 'application/x.ixbrl-viewer+json')
        self.assertEqual(body[3].text, 'END IXBRL VIEWER EXTENSIONS')

        jsdata = json.loads(body[2].text)
        errors = jsdata["validation"]
        self.assertEqual(errors, [{"sev": "ERROR", "msg": "Error message", "code": "code1" }])
        self.assertEqual(set(jsdata["facts"]), {"fact_id1", "fact_typed_dimension", "fact_dimension_missing_member"})

    @patch('arelle.XbrlConst.conceptLabel', 'http://www.xbrl.org/2003/arcrole/concept-label')
    @patch('arelle.XbrlConst.conceptReference', 'http://www.xbrl.org/2003/arcrole/concept-reference')
    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    @patch('arelle.XbrlConst.standardLabel', 'http://www.xbrl.org/2003/role/label')
    @patch('arelle.XbrlConst.documentationLabel', 'http://www.xbrl.org/2003/role/documentation')
    @patch('arelle.XbrlConst.dimensionDefault', 'http://xbrl.org/int/dim/arcrole/dimension-default')
    def test_createViewer(self):
        js_uri = 'ixbrlviewer.js'
        result = self.builder_2.createViewer(js_uri, showValidations = False)
        self.assertEqual(len(result.files),1)
        body = result.files[0].xmlDocument.getroot()[0]
        self.assertEqual(body[0].text, 'BEGIN IXBRL VIEWER EXTENSIONS')
        self.assertEqual(body[1].attrib.get('src'), js_uri)
        self.assertEqual(body[1].attrib.get('type'), 'text/javascript')
        self.assertEqual(body[2].attrib.get('type'), 'application/x.ixbrl-viewer+json')
        self.assertEqual(body[3].text, 'END IXBRL VIEWER EXTENSIONS')

        jsdata = json.loads(body[2].text)
        self.assertNotIn("validation", jsdata)
        self.assertEqual(set(jsdata["facts"]), {"fact_id1", "fact_typed_dimension", "fact_dimension_missing_member"})

    @patch('arelle.XbrlConst.conceptLabel', 'http://www.xbrl.org/2003/arcrole/concept-label')
    @patch('arelle.XbrlConst.conceptReference', 'http://www.xbrl.org/2003/arcrole/concept-reference')
    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.dimensionDefault', 'http://xbrl.org/int/dim/arcrole/dimension-default')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    @patch('arelle.XbrlConst.standardLabel', 'http://www.xbrl.org/2003/role/label')
    @patch('arelle.XbrlConst.documentationLabel', 'http://www.xbrl.org/2003/role/documentation')
    def test_createViewer_bad_path(self):
        js_uri = 'ixbrlviewer.js'
        result = self.builder_3.createViewer(js_uri)
        self.assertEqual(len(result.files),1)
        body = result.files[0].xmlDocument.getroot()[0]
        self.assertEqual(body[0].text, 'BEGIN IXBRL VIEWER EXTENSIONS')
        self.assertEqual(body[1].tag, '{http://www.w3.org/1999/xhtml}script')
        self.assertEqual(body[1].prefix, None)
        self.assertEqual(body[1].attrib.get('src'), js_uri)
        self.assertEqual(body[1].attrib.get('type'), 'text/javascript')
        self.assertEqual(body[2].tag, '{http://www.w3.org/1999/xhtml}script')
        self.assertEqual(body[2].prefix, None)
        self.assertEqual(body[2].attrib.get('type'), 'application/x.ixbrl-viewer+json')
        self.assertEqual(body[3].text, 'END IXBRL VIEWER EXTENSIONS')

        jsdata = json.loads(body[2].text)
        facts = jsdata["facts"]
        self.assertEqual(facts.keys(), {"fact_id2", "fact_id3"})
        self.assertEqual(facts["fact_id2"]["a"]["u"], "iso4217:USD")
        self.assertEqual(facts["fact_id3"]["a"]["u"], None)


    def test_xhtmlNamespaceHandling(self):
        # Check the prefix used for our inserted script tags
        tests = ('''
            <html xmlns="http://www.w3.org/1999/xhtml">
                <body>
                </body>
            </html>
        ''',
        '''
            <html xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/1999/xhtml">
                <body>
                </body>
            </html>
        ''',
        # In this case we won't fix the root element to be in the default NS,
        # but our <script> tags will be.
        '''
            <xhtml:html xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/1999/xhtml">
                <body>
                </body>
            </xhtml:html>
        '''
        )

        for xmls in tests:
            xml = etree.parse(StringIO(xmls))

            js_uri = 'https://example.com/script-url'
            result = self.builder_1.addViewerToXMLDocument(xml, js_uri)

            body = xml.getroot()[0]
            self.assertEqual(body[0].text, 'BEGIN IXBRL VIEWER EXTENSIONS')
            self.assertEqual(body[1].tag, '{http://www.w3.org/1999/xhtml}script')
            self.assertEqual(body[1].prefix, None)
            self.assertEqual(body[1].attrib.get('src'), js_uri)
            self.assertEqual(body[1].attrib.get('type'), 'text/javascript')
            self.assertEqual(body[2].tag, '{http://www.w3.org/1999/xhtml}script')
            self.assertEqual(body[2].prefix, None)
            self.assertEqual(body[2].attrib.get('type'), 'application/x.ixbrl-viewer+json')
            self.assertEqual(body[3].text, 'END IXBRL VIEWER EXTENSIONS')

