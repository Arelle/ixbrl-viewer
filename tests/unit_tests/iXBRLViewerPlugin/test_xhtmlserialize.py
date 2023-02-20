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

    def _checkTagExpansion(self, html_in, html_out):
        writer = XHTMLSerializer()
        doc = lxml.etree.fromstring(self._html(html_in))
        self.assertEqual(writer.write_element(doc), self._html(html_out))

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

        writer = XHTMLSerializer()
        writer.serialize(doc, f)

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

            # < and & can appear in CSS string
            (
                r'''<style>span::before { content: "&lt;&amp;" }</style>''',
                r'''<style>span::before { content: "\00003C\000026" }</style>''',
            ),

            # also escaped this way in comments, which is harmless
            (
                r'''<style>span { color: #777 } /* &lt;span> elements are styled this way */ </style>''',
                r'''<style>span { color: #777 } /* \00003Cspan> elements are styled this way */ </style>''',
            ),

            (
                r'''<div xmlns="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></div>''',
                r'''<div xmlns="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></div>''',
            ),
            (
                r'''<xhtml:div xmlns:xhtml="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></xhtml:div>''',
                r'''<xhtml:div xmlns:xhtml="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></xhtml:div>''',
            ),

            # Default and prefixed namespace for same URI.  Serialiser prefers unprefixed
            (
                r'''<xhtml:div xmlns="http://www.w3.org/1999/xhtml" xmlns:xhtml="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></xhtml:div>''',
                r'''<div xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg"></svg></div>''',
            ),

            # Text and tail and comment handling
            (
                r'''<div>Text<span>text</span>tail<!-- comment -->after comment<span>text</span>tail</div>''',
                r'''<div>Text<span>text</span>tail<!-- comment -->after comment<span>text</span>tail</div>'''
            ),

            (
                r'''<div><?my-pi attr1="val1" attr2="val2" ?></div>''',
                r'''<div><?my-pi attr1="val1" attr2="val2" ?></div>'''
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

        )


        serializer = XHTMLSerializer(xml_declaration=False)
        for (test_in, test_out) in tests:
            x = lxml.etree.fromstring(test_in)
            s = serializer.write_element(x)
            assert s == test_out

            # Round trip
            x2 = lxml.etree.fromstring(s)
            assert serializer.write_element(x2) == s

