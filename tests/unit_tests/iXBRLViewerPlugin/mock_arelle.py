from unittest.mock import Mock, patch
import sys

def qname_effect(prefix, namespaceURI, localName):
    return Mock(
        prefix=prefix,
        namespaceURI=namespaceURI,
        localName=localName
    )

def mrs_effect(dts, reltype):
    return Mock(
        fromModelObject = lambda source: []  
    )

def inferredDecimals_effect(fact):
    return float("INF")

def mock_arelle():

    # Don't replace an existing mocked arelle, as otherwise @patch calls will
    # patch the wrong Mock instance.
    if 'arelle' not in sys.modules:
        sys.modules['arelle'] = Mock()
        sys.modules['arelle.FileSource'] = Mock()
        sys.modules['arelle.LocalViewer'] = Mock()
        sys.modules['arelle.ModelDocument'] = Mock()
        sys.modules['arelle.ModelRelationshipSet'] = Mock(ModelRelationshipSet = mrs_effect)
        sys.modules['arelle.ModelValue'] = Mock(
            QName=qname_effect
        )
        sys.modules['arelle.PythonUtil'] = Mock()
        sys.modules['arelle.UrlUtil'] = Mock(
            isHttpUrl=lambda path: path.startswith('http')
        )
        sys.modules['arelle.ValidateXbrlCalcs'] = Mock(
            inferredDecimals=inferredDecimals_effect
        )
        sys.modules['arelle.webserver.bottle'] = Mock()
