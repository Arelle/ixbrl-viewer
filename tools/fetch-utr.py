#!/usr/bin/env python3

#
# Fetches the latest live utr.xml, extracts name and symbol, and writes it to
# src/data/utr.json for inclusion in the viewer. 
#

import requests
import json
from lxml import etree
import os

UTR_URL = 'https://www.xbrl.org/utr/utr.xml'
OUT_PATH = '../iXBRLViewerPlugin/viewer/src/data/utr.json'
UTR_NS = 'http://www.xbrl.org/2009/utr'

def elt_name(e):
    return "{%s}%s" % (UTR_NS, e)

print("Fetching " + UTR_URL)
res = requests.get(UTR_URL)
res.raise_for_status()

root = etree.fromstring(res.content, etree.XMLParser(remove_comments=True))

n = 0
units = {}

for e in root[0]:
    if e.find(elt_name("numeratorItemType")) is not None:
        # Skip complex units
        continue
    u = {}
    ns = e.find(elt_name("nsUnit")).text
    unitId = e.find(elt_name("unitId")).text
    units.setdefault(ns, {})[unitId] = u
    u["n"] = e.find(elt_name("unitName")).text
    symbol = e.find(elt_name("symbol"))
    if symbol is not None and symbol.text is not None and symbol.text != "":
        u["s"] = symbol.text
    n += 1

path = os.path.join(os.path.dirname(__file__), OUT_PATH)

with open(path, "w") as fout:
    json.dump(units, fout)

print("Wrote %d entries written to %s" % (n, path))
