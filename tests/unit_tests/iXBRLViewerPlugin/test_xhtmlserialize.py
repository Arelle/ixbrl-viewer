import lxml
import sys
import unittest
from unittest.mock import Mock
import io
from .mock_arelle import mock_arelle

mock_arelle()

from iXBRLViewerPlugin.xhtmlserialize import XHTMLSerializer

class TestXHTMLSerializer(unittest.TestCase):

    def _html(self, s):
        return '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>%s</body></html>' % s

    def _serialiseToString(self, xml, xml_declaration = False):
        buf = io.BytesIO()
        serializer = XHTMLSerializer(buf, xml_declaration)
        serializer.serialize(xml)
        return buf.getvalue().decode('utf-8')

    def _checkTagExpansion(self, html_in, html_out):
        doc = lxml.etree.fromstring(self._html(html_in))
        self.assertEqual(self._serialiseToString(doc), self._html(html_out))

    def test_expandEmptyTags(self):
        self._checkTagExpansion('<div/>', '<div></div>')
        self._checkTagExpansion('<div><span class="fish" /></div>', '<div><span class="fish"></span></div>')

        # Non-expanding tags
        self._checkTagExpansion('<br/>', '<br/>')
        self._checkTagExpansion('<br />', '<br/>')
        self._checkTagExpansion('<hr/>', '<hr/>')
        self._checkTagExpansion('<img />', '<img/>')

        # Mixed content
        self._checkTagExpansion('<div>foo<p /><p>bar</p></div>', '<div>foo<p></p><p>bar</p></div>')

        # Expanded tags that should be empty will be collapsed
        self._checkTagExpansion('<br></br>', '<br/>')

        # Only expand tags in the XHTML namespace
        self._checkTagExpansion('<div xmlns="other" />', '<div xmlns="other"></div>')

    def test_serialize(self):
        htmlsrc = self._html("<p>hello</p>")
        doc = lxml.etree.fromstring(htmlsrc)
        f = io.BytesIO()

        writer = XHTMLSerializer(f)
        writer.serialize(doc)

        # XML declaration should be added.
        self.assertEqual(f.getvalue().decode('utf-8'), '<?xml version="1.0" encoding="utf-8"?>\n' + htmlsrc)

    def test_custom_xml_serializer(self):
        tests = (
            # Self-closable elements should be collapsed
            (
                r'''<div><br></br><span></span></div>''',
                r'''<div><br/><span></span></div>'''
            ),

            # Non-self-closable element should be expanded
            (
                r'''<div><span/></div>''',
                r'''<div><span></span></div>'''
            ),

            # > is usually escaped
            (
                r'''<div> &lt;foo> &lt;bar&gt; &amp; </div>''',
                r'''<div> &lt;foo&gt; &lt;bar&gt; &amp; </div>'''
            ),

            # > is not escaped in a style tag
            (
                r'''<style>div &gt; p { color: #777 }</style>''',
                r'''<style>div > p { color: #777 }</style>''',
            ),

            # < and & can appear in CSS string.  We leave them as is, even
            # thought this won't work in HTML mode
            (
                r'''<style>span::before { content: "&lt;&amp;" }</style>''',
                r'''<style>span::before { content: "&lt;&amp;" }</style>''',
            ),

            # also escaped this way in comments
            (
                r'''<style>span { color: #777 } /* &lt;span> elements are styled this way */ </style>''',
                r'''<style>span { color: #777 } /* &lt;span> elements are styled this way */ </style>''',
            ),

            (
                r'''<div xmlns="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></div>''',
                r'''<div xmlns="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></div>''',
            ),
            (
                r'''<xhtml:div xmlns:xhtml="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></xhtml:div>''',
                r'''<xhtml:div xmlns:xhtml="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></xhtml:div>''',
            ),

            # Default and prefixed namespace for same URI.  Choioce of prefix should be preserved
            (
                r'''<xhtml:div xmlns="http://www.w3.org/1999/xhtml" xmlns:xhtml="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></xhtml:div>''',
                r'''<xhtml:div xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></xhtml:div>''',
            ),

            # Default and prefixed namespace for same URI.  Choioce of prefix should be preserved
            (
                r'''<div xmlns="http://www.w3.org/1999/xhtml" xmlns:xhtml="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></div>''',
                r'''<div xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></div>''',
            ),

            # Unprefixed attributes have no namespace, not default namespace
            (
                r'''<div xmlns="http://www.w3.org/1999/xhtml" xmlns:xhtml="http://www.w3.org/1999/xhtml"><span bar="baz" xhtml:foo="bar"></span></div>''',
                r'''<div xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/1999/xhtml"><span bar="baz" xhtml:foo="bar"></span></div>''',
            ),

            # Text and tail and comment handling
            (
                r'''<div>Text<span>text</span>tail<!-- comment -->after comment<span>text</span>tail</div>''',
                r'''<div>Text<span>text</span>tail<!-- comment -->after comment<span>text</span>tail</div>'''
            ),

            # PI trailing space handling
            (
                r'''<div><?my-pi attr1="val1" attr2="val2" ?></div>''',
                r'''<div><?my-pi attr1="val1" attr2="val2" ?></div>'''
            ),

            (
                r'''<div><?my-pi attr1="val1" attr2="val2"?></div>''',
                r'''<div><?my-pi attr1="val1" attr2="val2"?></div>'''
            ),

            (
                r'''<div><?my-pi ?></div>''',
                r'''<div><?my-pi?></div>'''
            ),

            # attribute escaping
            (
                r'''<div attr1="'foo>&amp;'">abc</div>''',
                r'''<div attr1="'foo&gt;&amp;'">abc</div>''',
            ),
            # Always uses double quotes
            (
                r'''<div attr1='"foo"'>abc</div>''',
                r'''<div attr1="&quot;foo&quot;">abc</div>''',
            ),
            # xml prefix doesn't need declaring
            (
                r'''<div xml:lang="en" attr='abc'>abc</div>''',
                r'''<div attr="abc" xml:lang="en">abc</div>''',
            ),
            # control characters escaped
            (
                r'''<div foo="&#128;">abc&#x81;&#127;</div>''',
                r'''<div foo="&#x80;">abc&#x81;&#x7F;</div>''',
            ),
            (
                # whitespace preservation
                r'''<div>
                        <br></br>
                        <span></span>
                    </div>''',
                r'''<div>
                        <br/>
                        <span></span>
                    </div>'''
            ),
            (
                # whitespace preservation
                # we can't test \r here, because lxml appears to convert
                # literal \r => \n (on unix) so the round trip fails
                '<div>&#x0A;/&#09;</div>',
                '<div>\n/\t</div>',
            ),
            (
                # ]]> is the one case where we do escape '>' in a style tag.
                '<div>]]&gt;<style>]]&gt;</style></div>',
                '<div>]]&gt;<style>]]&gt;</style></div>',
            ),

        )


        for (test_in, test_out) in tests:
            x = lxml.etree.fromstring(test_in)
            s = self._serialiseToString(x)
            assert s == test_out

            # Round trip
            x2 = lxml.etree.fromstring(s)
            assert self._serialiseToString(x2) == s


    def test_full_document_serialisation(self):
        tests = (
            # Self-closable elements should be collapsed
            (
                # Comment before body is preserved, but trailing whitespace normalised to single newline
                r'''<?xml version="1.0" ?>
                <!-- comment -->
                <div><br></br><span></span></div>''',
                r'''<!-- comment -->
<div><br/><span></span></div>'''
            ),
            (
                # Comment before body is preserved, but trailing whitespace normalised to single newline
                r'''

                <!-- comment -->
                <div><br></br><span></span></div>''',
                r'''<!-- comment -->
<div><br/><span></span></div>'''
            ),
            (
                # whitespace preservation
                '<div>&#x0D;/&#x0A;/&#09;</div>',
                '<div>\r/\n/\t</div>',
            ),
        )

        for (test_in, test_out) in tests:
            f = io.StringIO(test_in)
            x = lxml.etree.parse(f)
            s = self._serialiseToString(x)
            assert s == test_out


    def test_full_document_serialisation_with_xml_declaration(self):
        tests = (
            # Self-closable elements should be collapsed
            (
                r'''<?xml version="1.0" ?>
                <!-- comment -->
                <?pi?>
                <div><br></br><span></span></div>''',

                r'''<?xml version="1.0" encoding="utf-8"?>
<!-- comment -->
<?pi?>
<div><br/><span></span></div>'''
            ),
            (
                r'''
                <!-- comment -->
                <div><br></br><span></span></div>''',

                r'''<?xml version="1.0" encoding="utf-8"?>
<!-- comment -->
<div><br/><span></span></div>'''
            ),
            (
                r'''<?xml version="1.0" standalone="yes" ?> 
<div></div>''',
                r'''<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<div></div>''',
            ),
            (
                r'''<?xml version="1.1" standalone="no" ?> 
<div></div>''',
                r'''<?xml version="1.1" encoding="utf-8"?>
<div></div>''',
            ),
        )

        for (test_in, test_out) in tests:
            f = io.StringIO(test_in)
            x = lxml.etree.parse(f)
            s = self._serialiseToString(x, xml_declaration = True)
            assert s == test_out

    def test_document_modification(self):
        tests = (
            (
                # lxml allocates new prefixes for new element, and for namespace attribute (which can't use the default NS)
                r'''<div xmlns="http://www.example.com"><span>foo</span></div>''',
                r'''<div xmlns="http://www.example.com"><span>foo</span><ns0:abc xmlns:ns0="http://www.example.com/ns2" xmlns:ns1="http://www.example.com" ns1:attr="def"></ns0:abc></div>'''
            ),
            (
                # lxml allocates new ns0 prefix to new element, overriding previous binding, and allocates ns1 for the attribute
                r'''<ns0:div xmlns:ns0="http://www.example.com"><span>foo</span></ns0:div>''',
                r'''<ns0:div xmlns:ns0="http://www.example.com"><span>foo</span><ns0:abc xmlns:ns0="http://www.example.com/ns2" xmlns:ns1="http://www.example.com" ns1:attr="def"></ns0:abc></ns0:div>'''
            ),
            (
                # newly allocated ns0 doesn't override abc binding, so it can be re-used for the attribute
                r'''<abc:div xmlns:abc="http://www.example.com"><span>foo</span></abc:div>''',
                r'''<abc:div xmlns:abc="http://www.example.com"><span>foo</span><ns0:abc xmlns:ns0="http://www.example.com/ns2" abc:attr="def"></ns0:abc></abc:div>'''
            ),
            (
                # newly allocated ns0 doesn't override abc binding, so it can be re-used for the attribute
                r'''<abc:div xmlns:abc="http://www.example.com/ns2"><span>foo</span></abc:div>''',
                r'''<abc:div xmlns:abc="http://www.example.com/ns2"><span>foo</span><abc:abc xmlns:ns0="http://www.example.com" ns0:attr="def"></abc:abc></abc:div>'''
            ),
        )

        for (test_in, test_out) in tests:
            f = io.StringIO(test_in)
            x = lxml.etree.parse(f)
            e = lxml.etree.Element("{http://www.example.com/ns2}abc")
            x.getroot().append(e)
            e.set("{http://www.example.com}attr", "def")
            s = self._serialiseToString(x)
            assert s == test_out
