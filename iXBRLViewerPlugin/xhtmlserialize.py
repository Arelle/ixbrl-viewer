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

from lxml import etree
from enum import Enum
import re

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

    ENTITIES = {
        '>': '&gt;',
        '<': '&lt;',
        '"': '&quot;',
        '&': '&amp;'
        }

    def __init__(self, fout, xml_declaration = True, assume_xhtml = True):
        self.fout = fout
        self.encoding = "utf-8"
        self.xml_declaration = xml_declaration
        self.assume_xhtml = assume_xhtml

    def write(self, s):
        self.fout.write(s.encode(self.encoding))

    def prefix_sort(self, p):
        return p if p is not None else '0'

    def qname_for_node(self, node):
        qname = etree.QName(node.tag)
        if qname.namespace is None:
            prefix = None
        elif node.nsmap.get(node.prefix, None) == qname.namespace:
            prefix = node.prefix
        else:
            prefix = next(iter(sorted((p for p, ns in nsmap.items() if ns == qname.namespace), key = self.prefix_sort)))
        if prefix is None:
            return qname.localname
        return "%s:%s" % (prefix, qname.localname)

    def qname_for_attr(self, tag, nsmap):
        qname = etree.QName(tag)
        if qname.namespace is None:
            return qname.localname
        if qname.namespace == XML_NS:
            prefix = 'xml'
        else:
            prefix = next(iter(sorted((p for p, ns in nsmap.items() if ns == qname.namespace and p is not None), key = self.prefix_sort)))
        return "%s:%s" % (prefix, qname.localname)

    def is_selfclosable(self, n):
        qname = etree.QName(n)
        return (
                qname.localname in XHTMLSerializer.SELF_CLOSABLE
                and (
                    qname.namespace == XHTML_NS
                    or (self.assume_xhtml and qname.namespace is None)))

    def escape_attr(self, s):
        return re.sub(r'([<>"&])', lambda m: self.ENTITIES[m.group(0)], s)

    def xmlns_declaration(self, prefix, uri):
        if prefix is None:
            return 'xmlns="%s"' % self.escape_attr(uri)
        return 'xmlns:%s="%s"' % (prefix, self.escape_attr(uri))

    def namespace_declarations(self, new_nsmap, cur_nsmap):
        changed = set(p[0] for p in (set(new_nsmap.items()) ^ set(cur_nsmap.items())))
        return sorted(self.xmlns_declaration(p, new_nsmap[p]) for p in changed)

    def write_escape_text(self, s, escape_mode):
        if s is None:
            return
        if escape_mode == EscapeMode.STYLE:
            # HTML does not understand XML escapes inside a style element.
            # Don't escape ">".  Escaping isn't required by XML, but is common
            # practice, so we do it elsewhere.
            # "&" and "<" may only appear in a string or comment in CSS, so escape
            # as if they're in a string.
            self.write(re.sub(r'([<&])', lambda m: "\\%06X" % ord(m.group(1)), s))
        else:
            self.write(re.sub(r'([<>&])', lambda m: self.ENTITIES[m.group(0)], s))

    def write_attributes(self, node):
        for qname, value in sorted((self.qname_for_attr(k, node.nsmap), v) for k, v in node.items()):
            self.write(' %s="' % qname)
            self.write(self.escape_attr(value))
            self.write("\"")

    def write_comment(self, n, escape_mode):
        self.write('<!--' + n.text + '-->')
        self.write_escape_text(n.tail, escape_mode)

    def write_processing_instruction(self, n, escape_mode):
        self.write( '<?' + n.target + ' ' + n.text + '?>')
        self.write_escape_text(n.tail, escape_mode)

    def write_node(self, n, nsmap = {}, escape_mode = EscapeMode.DEFAULT):
        if isinstance(n, etree._Comment):
            self.write_comment(n, escape_mode)
        elif isinstance(n, etree._ProcessingInstruction):
            self.write_processing_instruction(n, escape_mode)
        else:
            self.write_element(n, nsmap, escape_mode)

    def write_element(self, n, parent_nsmap = {}, escape_mode = EscapeMode.DEFAULT):
        name = self.qname_for_node(n)
        qname = etree.QName(n.tag)
        selfclose = len(n) == 0 and n.text is None and self.is_selfclosable(n)
        parts = [ name ] + self.namespace_declarations(n.nsmap, parent_nsmap) 
        self.write('<' + ' '.join(parts))
        self.write_attributes(n)

        if qname.localname == 'style':
            inner_escape_mode = EscapeMode.STYLE
        else:
            inner_escape_mode = escape_mode

        if selfclose:
            self.write('/>')
        else:
            self.write('>')
            self.write_escape_text(n.text, inner_escape_mode)
            for child in n.iterchildren():
                self.write_node(child, n.nsmap, inner_escape_mode)
            self.write('</%s>' % name)

        self.write_escape_text(n.tail, escape_mode)

    def serialize(self, element):
        if self.xml_declaration:
            self.write('<?xml version="1.0" encoding="utf-8"?>\n')
        if hasattr(element, 'getroot'):
            element = element.getroot()
            while element.getprevious() is not None:
                element = element.getprevious()

            while element is not None:
                self.write_node(element)
                if isinstance(element, (etree._Comment, etree._ProcessingInstruction)):
                    self.write("\n")
                element = element.getnext()

        else:
            self.write_element(element)

