#!/usr/bin/env python3

#
# Fetches the latest live utr.xml, extracts name and symbol, and writes it to
# src/data/utr.json for inclusion in the viewer.
#

import json
import os
import sys

import requests
from lxml import etree

UTR_URL = "https://www.xbrl.org/utr/utr.xml"
OUT_PATH = "../iXBRLViewerPlugin/viewer/src/data/utr.json"
UTR_NS = "http://www.xbrl.org/2009/utr"


def elt_name(e):
    return "{%s}%s" % (UTR_NS, e)


if len(sys.argv) > 1:
    utr_url = sys.argv[1]
else:
    utr_url = UTR_URL

parser = etree.XMLParser(remove_comments=True)
if os.path.isfile(utr_url):
    print(f"Using file {utr_url}")
    root = etree.parse(utr_url, parser).getroot()
else:
    print(f"Fetching {utr_url}")
    res = requests.get(utr_url)
    res.raise_for_status()
    root = etree.fromstring(res.content, parser)

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
