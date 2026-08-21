# Element-pointer corpus (mirror)

A byte-identical copy of
`tests/resources/html-element-pointer/` in the Arelle repository, which is the
canonical location and holds the generator.

It is mirrored rather than fetched because the two test suites must be
hermetic — `node-tests.yml` checks out this repository alone, and a fixture
reachable only through a sibling checkout would not run in CI. The whole
directory is under 20 KB.

`elementPointer.corpus.test.js` and the Arelle suite's
`test_html_element_pointer.py` both pin the SHA-256 of `expected-pointers.json`
in a `CORPUS_SHA256` literal, so a copy updated on one side without the other
fails rather than drifting. To change anything here: edit the fixture in the
Arelle repository, re-run `generate.py`, copy this directory across, and update
both literals.

The heavy demonstration documents — `msft-ar25-html5.html`,
`loreal-ar25-html5.html`, the filings — are deliberately absent. They are a
local confidence run, not a gate; these three fixtures are the gate.
