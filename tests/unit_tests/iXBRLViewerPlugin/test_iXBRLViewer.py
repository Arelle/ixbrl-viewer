import lxml
import sys
import unittest
from collections import defaultdict
from unittest.mock import Mock, patch


def qname_effect(prefix, namespaceURI, localName):
    return Mock(
        prefix=prefix,
        namespaceURI=namespaceURI,
        localName=localName
    )


sys.modules['arelle'] = Mock()
sys.modules['arelle.XbrlConst'] = Mock()
sys.modules['arelle.ModelValue'] = Mock(
    QName=qname_effect
)
sys.modules['arelle.ValidateXbrlCalcs'] = Mock()

from iXBRLViewerPlugin.iXBRLViewer import NamespaceMap, IXBRLViewerBuilder


class TestNamespaceMap(unittest.TestCase):

    def test_getPrefix_with_none(self):
        """
        Tests NamespaceMap.getPrefix with None. Should return default namespace.
        """
        ns_map = NamespaceMap()
        result = ns_map.getPrefix(None)
        self.assertEqual(result, 'ns0')

    def test_getPrefix_with_none_with_prefix(self):
        """
        Tests NamespaceMap.getPrefix with None. Should return prefix.
        """
        ns_map = NamespaceMap()
        prefix = 'prefix'
        result = ns_map.getPrefix(None, prefix)
        self.assertEqual(result, prefix)

    def test_getPrefix_with_namespace(self):
        """
        Tests NamespaceMap.getPrefix with None. Should default namespace.
        """
        ns_map = NamespaceMap()
        namespace = 'namespace'
        result = ns_map.getPrefix(namespace)
        self.assertEqual(result, 'ns0')

    def test_getPrefix_with_namespace_with_prefix(self):
        """
        Tests NamespaceMap.getPrefix with None. Should return prefix.
        """
        ns_map = NamespaceMap()
        namespace = 'namespace'
        prefix = 'prefix'
        result = ns_map.getPrefix(namespace, prefix)
        self.assertEqual(result, prefix)

    def test_getPrefix_subsequent_call_with_namespace(self):
        """
        Tests NamespaceMap.getPrefix with None. Should return default namespace.
        """
        ns_map = NamespaceMap()
        namespace = 'namespace'
        result = ns_map.getPrefix(namespace)
        self.assertEqual(result, 'ns0')
        result_2 = ns_map.getPrefix(namespace)
        self.assertEqual(result_2, 'ns0')

    def test_getPrefix_subsequent_call_with_namespace_and_prefix(self):
        """
        Tests NamespaceMap.getPrefix with None. Should return prefix.
        """
        ns_map = NamespaceMap()
        namespace = 'namespace'
        prefix = 'prefix'
        result = ns_map.getPrefix(namespace, prefix)
        self.assertEqual(result, prefix)
        result_2 = ns_map.getPrefix(namespace, prefix)
        self.assertEqual(result_2, prefix)

    def test_getPrefix_subsequent_call_with_namespace_and_prefix(self):
        """
        Tests NamespaceMap.getPrefix with None. Should return default namespaces.
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

        def isoformat_effect():
            return '01-01-19T00:00:00'

        context = Mock(
            entityIdentifier=('scheme', 'ident'),
            qnameDims={'d': dimension},
            isInstantPeriod=False,
            isStartEndPeriod=True,
            startDatetime=Mock(isoformat=isoformat_effect),
            endDatetime=Mock(isoformat=isoformat_effect)
        )

        fact = Mock(
            id='fact_id',
            qname=self.cash_concept.qname,
            value=100,
            isNumeric=False,
            context=context,
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
        baseSets[('http://www.xbrl.org/2003/arcrole/parent-child', 'ELR', 'linkqname', 'arcqname')] = []

        root = lxml.etree.Element('root')
        lxml.etree.SubElement(root, '{http://www.w3.org/1999/xhtml}body')

        self.modelDocument = Mock(
            xmlDocument=lxml.etree.ElementTree(root)
        )

        self.modelXbrl = Mock(
            relationshipSet=relationshipSet_effect,
            baseSets=baseSets,
            facts=[fact],
            info=info_effect,
            modelDocument=self.modelDocument
        )
        self.cash_concept.modelXbrl = self.modelXbrl
        to_concept.modelXbrl = self.modelXbrl
        from_concept.modelXbrl = self.modelXbrl
        dimension_concept.modelXbrl = self.modelXbrl
        member_concept.modelXbrl = self.modelXbrl
        self.builder = IXBRLViewerBuilder(self.modelXbrl)

    @patch('arelle.XbrlConst.conceptLabel', 'http://www.xbrl.org/2003/arcrole/concept-label')
    @patch('arelle.XbrlConst.conceptReference', 'http://www.xbrl.org/2003/arcrole/concept-reference')
    def test_addConcept_simple_case(self):
        self.builder.addConcept(self.cash_concept)
        self.assertTrue(self.builder.taxonomyData.get('concepts').get('us-gaap:Cash'))

    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    def test_getRelationships_simple_case(self):
        modelXbrl = Mock(baseSets=defaultdict(list))
        builder = IXBRLViewerBuilder(modelXbrl)
        result = builder.getRelationnShips()
        self.assertDictEqual(result, {})

    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    def test_getRelationships_returns_a_rel(self):
        result = self.builder.getRelationnShips()
        self.assertTrue(result.get('ns0').get('ELR').get('us-gaap:from_concept'))

    @patch('arelle.XbrlConst.conceptLabel', 'http://www.xbrl.org/2003/arcrole/concept-label')
    @patch('arelle.XbrlConst.conceptReference', 'http://www.xbrl.org/2003/arcrole/concept-reference')
    @patch('arelle.XbrlConst.parentChild', 'http://www.xbrl.org/2003/arcrole/parent-child')
    @patch('arelle.XbrlConst.summationItem', 'http://www.xbrl.org/2003/arcrole/summation-item')
    @patch('arelle.XbrlConst.standardLabel', 'http://www.xbrl.org/2003/role/label')
    @patch('arelle.XbrlConst.documentationLabel', 'http://www.xbrl.org/2003/role/documentation')
    def test_createViewer(self):
        js_uri = 'ixbrlviewer.js'
        result = self.builder.createViewer(js_uri)
        body = result.getroot()[0]
        self.assertEqual(body[0].text, 'BEGIN IXBRL VIEWER EXTENSIONS')
        self.assertEqual(body[1].attrib.get('src'), js_uri)
        self.assertEqual(body[2].attrib.get('id'), 'taxonomy-data')
        self.assertEqual(body[2].attrib.get('type'), 'application/json')
        self.assertEqual(body[3].text, 'END IXBRL VIEWER EXTENSIONS')
