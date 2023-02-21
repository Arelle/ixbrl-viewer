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

    def escape_text(self, s, escape_mode):
        if s is None:
            return ''
        if escape_mode == EscapeMode.STYLE:
            # Don't escape >
            # & and < may only appear in a string or comment in CSS, so escape
            # as if they're in a string.
            return re.sub(r'([<&])', lambda m: "\\%06X" % ord(m.group(1)), s)
        return re.sub(r'([<>&])', lambda m: self.ENTITIES[m.group(0)], s)

    def attributes(self, node):
        return sorted(
            '%s="%s"' % (self.qname_for_attr(k, node.nsmap), self.escape_attr(v))
                for k, v in node.items()
            )

    def write_comment(self, n, escape_mode):
        self.write('<!--' + n.text + '-->' + self.escape_text(n.tail, escape_mode))

    def write_processing_instruction(self, n, escape_mode):
        self.write( '<?' + n.target + ' ' + n.text + '?>' + self.escape_text(n.tail, escape_mode))

    def write_element(self, n, parent_nsmap = {}, escape_mode = EscapeMode.DEFAULT):
        name = self.qname_for_node(n)
        qname = etree.QName(n.tag)
        selfclose = len(n) == 0 and n.text is None and self.is_selfclosable(n)
        parts = [ name ] + self.namespace_declarations(n.nsmap, parent_nsmap) + self.attributes(n)
        self.write('<' + ' '.join(parts))

        if qname.localname == 'style':
            inner_escape_mode = EscapeMode.STYLE
        else:
            inner_escape_mode = escape_mode

        if selfclose:
            self.write('/>')
        else:
            self.write('>' + self.escape_text(n.text, inner_escape_mode))

            for child in n.iterchildren():
                if isinstance(child, etree._Comment):
                    self.write_comment(child, inner_escape_mode)
                elif isinstance(child, etree._ProcessingInstruction):
                    self.write_processing_instruction(child, inner_escape_mode)
                else:
                    self.write_element(child, n.nsmap, inner_escape_mode)
            self.write('</%s>' % name)

        self.write(self.escape_text(n.tail, escape_mode))

    def serialize(self, element):
        if hasattr(element, 'getroot'):
            element = element.getroot()
        if self.xml_declaration:
            self.write('<?xml version="1.0" encoding="utf-8"?>\n')
        self.write_element(element)
