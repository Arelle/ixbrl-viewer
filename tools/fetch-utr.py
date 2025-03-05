#!/usr/bin/env python3

#
# Fetches the latest live utr.xml (or, optionally, the file specified on the
# command line), extracts name and symbol, and writes it to src/data/utr.json
# for inclusion in the viewer.
#

import datetime
import hashlib
import json
import os
import sys

import requests
from lxml import etree

UTR_URL = "https://www.xbrl.org/utr/utr.xml"
OUT_PATH = "../iXBRLViewerPlugin/viewer/src/data/utr.json"
UTR_NS = "http://www.xbrl.org/2009/utr"
SUPPORTED_URL_PROTOCOLS = ("http:", "https:")


def elt_name(e):
    return "{%s}%s" % (UTR_NS, e)


match len(sys.argv):
    case 1:
        utr_url = UTR_URL
    case 2:
        utr_url = sys.argv[1]
    case _:
        raise SystemExit("Error: specifying more than one UTR source is unsupported.")
print(f"Fetching source: {utr_url}")

if os.path.isfile(utr_url):
    with open(utr_url, "rb") as f:
        bytes = f.read()
elif utr_url.startswith(SUPPORTED_URL_PROTOCOLS):
    res = requests.get(utr_url)
    res.raise_for_status()
    bytes = res.content
else:
    raise SystemExit(
        f"Error: {utr_url} is neither a local file or a URL with a supported protocol ({', '.join(SUPPORTED_URL_PROTOCOLS)})."
    )

root = etree.fromstring(bytes, etree.XMLParser(remove_comments=True))

n = 0
units = {
    "_source": {
        "url": utr_url,
        "sha256": hashlib.sha256(bytes).hexdigest(),
        "timestamp": datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat(),
    }
}
print(
    "Source metadata:",
    *(f"{key:10s}: {value}" for key, value in sorted(units["_source"].items())),
    sep="\n",
)

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
    json.dump(units, fout, indent=2, sort_keys=True)
    fout.write("\n")

print("Wrote %d entries written to %s" % (n, path))
