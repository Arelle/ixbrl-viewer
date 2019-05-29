#!/usr/bin/env python3

import json
import os
import re
import sys
from urllib.parse import urlparse
from urllib.request import urlretrieve
import hashlib

def sha256sum(filename):
    h  = hashlib.sha256()
    b  = bytearray(128*1024)
    mv = memoryview(b)
    with open(filename, 'rb', buffering=0) as f:
        for n in iter(lambda : f.readinto(mv), 0):
            h.update(mv[:n])
    return h.hexdigest()

print("Checking for sample files/packages...")

basedir = os.path.dirname(os.path.realpath(__file__))
filename = os.path.join(basedir, "sample-files.list")
missing_checksums = []

with open(filename, "r") as f:
    for l in f.readlines():
        if re.match(r'^\s*(#.*)?$', l) is not None:
            continue
        m = re.match(r'^(\S*)\s+(\S+)\s*(?:\s+(\S+))?$',l)
        if m is None:
            print("Unexpected line: %s" % l)
            sys.exit(1)
        (subdir, url, fhash) = (m[1], m[2], m[3])
        if subdir == '':
            subdir = prev_subdir
        prev_subdir = subdir

        if '|' in url:
            (url, filepart) = url.split('|')
        else:
            o = urlparse(url)
            m = re.search(r'[^/]+$', o.path)
            if m is None:
                print("Could not get filename from: %s" % o.path)
            filepart = m[0]

        target_dir = os.path.join(basedir, subdir)
        target = os.path.join(target_dir, filepart)
        if not os.path.exists(target):
            if not os.path.exists(target_dir):
                print("Creating %s" % target_dir)
                os.makedirs(target_dir)

            print("Downloading %s to %s" % (url, target))
            urlretrieve(url, target)

        actual_fhash = sha256sum(target)
        if fhash is None:
            missing_checksums.append("%s %s %s" % (subdir, url, actual_fhash))
        else:
            if actual_fhash != fhash:
                print("Checksum does not match for %s (expected: %s, got: %s)" % (target, fhash, actual_fhash)) 

if len(missing_checksums) > 0:
    print("\n".join(missing_checksums))


