# See COPYRIGHT.md for copyright information

from __future__ import annotations

import re
from enum import Enum
from typing import IO

from lxml import etree

XHTML_NS = 'http://www.w3.org/1999/xhtml'
XML_NS = 'http://www.w3.org/XML/1998/namespace'

class EscapeMode(Enum):
    DEFAULT = 0
    STYLE = 1

class XHTMLSerializer:

    # From https://www.w3.org/TR/html401/index/elements.html
    SELF_CLOSABLE = (
        'area', 'base', 'basefont', 'br', 'col', 'frame', 'hr', 'img', 
        'input', 'isindex', 'link', 'meta', 'param'
    )

    ESCAPES = {
        ']]>': ']]&gt;',
        '>': '&gt;',
        '<': '&lt;',
        '"': '&quot;',
        '&': '&amp;'
        }

    MUST_ESCAPE_CHARS = r'<&\u0001-\u0008\u000B\u000C\u000E\u001F\u007F-\u009F'
    CDATA_END = r']]>'

    ESCAPE_RE = re.compile('([' + MUST_ESCAPE_CHARS + '>])')
    ATTR_ESCAPE_RE = re.compile('([' + MUST_ESCAPE_CHARS + '>"])')
    STYLE_ESCAPE_RE = re.compile('([' + MUST_ESCAPE_CHARS + ']|' + CDATA_END + ')')

    def __init__(self, fout: IO[bytes], xml_declaration: bool = True, assume_xhtml: bool = True) -> None:
        self.fout = fout
        self.encoding = "utf-8"
        self.xml_declaration = xml_declaration
        self.assume_xhtml = assume_xhtml

    def write(self, s: str) -> None:
        self.fout.write(s.encode(self.encoding))

    def prefix_sort(self, p: str | None) -> str:
        return p if p is not None else '0'

    def qname_for_node(self, node: etree._Element) -> str:
        qname = etree.QName(node)
        if qname.namespace is None:
            prefix = None
        elif node.nsmap.get(node.prefix, None) == qname.namespace:
            prefix = node.prefix
        else:
            prefix = next(iter(sorted((p for p, ns in node.nsmap.items() if ns == qname.namespace), key = self.prefix_sort)))
        if prefix is None:
            return qname.localname
        return f"{prefix}:{qname.localname}"

    def qname_for_attr(self, tag: etree._Element | str, nsmap: dict[str | None, str]) -> str:
        qname = etree.QName(tag)
        if qname.namespace is None:
            return qname.localname
        if qname.namespace == XML_NS:
            prefix = 'xml'
        else:
            prefix = next(iter(sorted((p for p, ns in nsmap.items() if ns == qname.namespace and p is not None), key = self.prefix_sort)))
        return f"{prefix}:{qname.localname}"

    def is_selfclosable(self, n: etree._Element | str) -> bool:
        qname = etree.QName(n)
        return (
                qname.localname in XHTMLSerializer.SELF_CLOSABLE
                and (
                    qname.namespace == XHTML_NS
                    or (self.assume_xhtml and qname.namespace is None)))

    def escape_attr(self, s: str) -> str:
        return self.ATTR_ESCAPE_RE.sub(lambda m: self.escape_str(m[0]), s)

    def xmlns_declaration(self, prefix: str | None, uri: str) -> str:
        if prefix is None:
            return f'xmlns="{self.escape_attr(uri)}"'
        return f'xmlns:{prefix}="{self.escape_attr(uri)}"'

    def namespace_declarations(self, new_nsmap: dict[str | None, str], cur_nsmap: dict[str | None, str]) -> list[str]:
        changed = set(p[0] for p in (set(new_nsmap.items()) ^ set(cur_nsmap.items())))
        return sorted(self.xmlns_declaration(p, new_nsmap[p]) for p in changed)

    def escape_str(self, c: str) -> str:
        return self.ESCAPES.get(c, f'&#x{ord(c[0]):02X};')

    def write_escape_text(self, s: str | None, escape_mode: EscapeMode) -> None:
        if s is None:
            return
        if escape_mode == EscapeMode.STYLE:
            # HTML does not understand XML escapes inside a style element.
            # Don't escape ">".  Escaping isn't required by XML, but is common
            # practice, so we do it elsewhere.
            # "&" and "<" are escaped using XML escapes.  This will break
            # HTML/XHTML compatibility, but any source document using them
            # wouldn't have been HTML compatible anyway.
            self.write(self.STYLE_ESCAPE_RE.sub(lambda m: self.escape_str(m[0]),s))
        else:
            self.write(self.ESCAPE_RE.sub(lambda m: self.escape_str(m[0]),s))

    def write_attributes(self, node: etree._Element) -> None:
        for qname, value in sorted((self.qname_for_attr(k, node.nsmap), v) for k, v in node.items()):
            self.write(f' {qname}="')
            self.write(self.escape_attr(value))
            self.write("\"")

    def write_comment(self, n: etree._Comment, escape_mode: EscapeMode) -> None:
        self.write('<!--' + n.text + '-->')
        self.write_escape_text(n.tail, escape_mode)

    def write_processing_instruction(self, n: etree._ProcessingInstruction, escape_mode: EscapeMode) -> None:
        self.write( '<?' + n.target )
        if n.text != '':
            self.write(' ' + n.text)
        self.write('?>')
        self.write_escape_text(n.tail, escape_mode)

    def write_node(
        self,
        n: etree._Element,
        nsmap: dict[str | None, str] | None = None,
        escape_mode: EscapeMode = EscapeMode.DEFAULT,
    ) -> None:
        if nsmap is None:
            nsmap = {}
        if isinstance(n, etree._Comment):
            self.write_comment(n, escape_mode)
        elif isinstance(n, etree._ProcessingInstruction):
            self.write_processing_instruction(n, escape_mode)
        else:
            self.write_element(n, nsmap, escape_mode)

    def write_element(
        self,
        n: etree._Element,
        parent_nsmap: dict[str | None, str] | None = None,
        escape_mode: EscapeMode = EscapeMode.DEFAULT,
    ) -> None:
        if parent_nsmap is None:
            parent_nsmap = {}
        name = self.qname_for_node(n)
        qname = etree.QName(n)
        selfclose = len(n) == 0 and n.text is None and self.is_selfclosable(n)
        parts = [ name ] + self.namespace_declarations(n.nsmap, parent_nsmap)
        self.write('<' + ' '.join(parts))
        self.write_attributes(n)

        inner_escape_mode = EscapeMode.STYLE if qname.localname == 'style' else escape_mode

        if selfclose:
            self.write('/>')
        else:
            self.write('>')
            self.write_escape_text(n.text, inner_escape_mode)
            for child in n.iterchildren():
                self.write_node(child, n.nsmap, inner_escape_mode)
            self.write(f'</{name}>')

        self.write_escape_text(n.tail, escape_mode)

    def write_xml_declaration(self, docinfo: etree.DocInfo | None = None) -> None:
        if self.xml_declaration:
            version = "1.0"
            standalone = ""
            if docinfo is not None:
                version = docinfo.xml_version
                if docinfo.standalone:
                    standalone = ' standalone="yes"'
            self.write(f'<?xml version="{version}" encoding="{self.encoding}"{standalone}?>\n')

    def serialize(self, element: etree._ElementTree[etree._Element] | etree._Element) -> None:
        if isinstance(element, etree._ElementTree):
            self.write_xml_declaration(element.docinfo)

            node: etree._Element | None = element.getroot()
            while node is not None and node.getprevious() is not None:
                node = node.getprevious()

            while node is not None:
                self.write_node(node)
                if isinstance(node, (etree._Comment, etree._ProcessingInstruction)):
                    self.write("\n")
                node = node.getnext()

        else:
            self.write_xml_declaration()
            self.write_element(element)
