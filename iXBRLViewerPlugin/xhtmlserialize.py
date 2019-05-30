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
import re

class XHTMLSerializer:

    # From https://www.w3.org/TR/html401/index/elements.html
    selfClosableElements = (
        'area', 'base', 'basefont', 'br', 'col', 'frame', 'hr', 'img', 
        'input', 'isindex', 'link', 'meta', 'param'
    )

    def _expandEmptyTags(self, xml):
        """
        Expand self-closing tags

        Self-closing tags cause problems for XHTML documents when treated as
        HTML.  Tags that are required to be empty (e.g. <br>) are left as
        self-closing.
        """
        for e in xml.iter('*'):
            m = re.match(r'\{http://www\.w3\.org/1999/xhtml\}(.*)', e.tag)
            if m is not None and m.group(1) not in XHTMLSerializer.selfClosableElements and e.text is None:
                e.text = ''

    def serialize(self, xmlDocument, fout):
        self._expandEmptyTags(xmlDocument)
        fout.write(etree.tostring(xmlDocument, method="xml", encoding="utf-8", xml_declaration=True))
