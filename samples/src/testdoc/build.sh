#!/bin/bash

set -x

jinja2 example-calc.xml.tmpl calc.json > example-calc.xml
jinja2 example-label.xml.tmpl labels.json > example-label.xml
aoix testdoc.ixtmpl  > testdoc.html
