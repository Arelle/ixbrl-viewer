# HTML5 locators — what the viewer does and doesn't need

How `valueSource` locators resolve when the source document is plain HTML5 rather than
legacy inline XBRL (XHTML). Companion to the spec-side note,
`oim/specifications/oim-taxonomy/documentation/HTML5_LOCATOR_PARSING.md`.

**Status:** investigation complete, no viewer change required yet. The conclusions below
become actionable when positional pointers land alongside `xbrl:htmlElementId`.

---

## The headline: the viewer needs no HTML5 parser

`htmlDocumentSurface.js` loads the source document into an **iframe** and resolves facts
against that document:

```js
const doc = iframe.contentDocument || iframe.contentWindow.document;   // prepareDocument
el = body.querySelector("#" + CSS.escape(spanId));                     // id lookup
```

The iframe's DOM *is* a conformant HTML5 parse, produced by the host browser. There is
nothing to add on the JS side — no parser dependency, no third surface. The problem this
investigation set out to solve is entirely on the **producer** side: making Arelle's
Python parse agree with what this iframe will do.

Measured over 1,600 cases of the html5lib-tests tree-construction corpus, run through real
Safari 26.6.2 and real Chrome, Safari and Chrome agreed on 1575/1600 — and **all 25
disagreements are `<select>` content parsing. Zero involve ordinary document constructs.**
So a pointer computed against a conformant parse resolves the same in whatever engine a
viewer user happens to be running.

## When positional pointers arrive, resolve them here

Today the surface is `htmlElementId`-only, which is position-independent and therefore
immune to every parser difference. A positional pointer changes that. Two rules:

**1. Walk `children[i]` — never hand a path to `querySelector`.**

Measured on a 182 MB / 1.08 M-element document:

| Approach | Per lookup |
|---|---:|
| Child-index path, resolved via one indexing pass | **0.78 µs** |
| `@id` dictionary | 0.80 µs |
| CSS `nth-child` chain | **43.8 s** |

Selector matching runs right-to-left, so a trailing `*:nth-child(n)` has no selectivity —
the engine tests every element in the document, then verifies ancestry. Browsers do this
too. In DOM `children[i]` is O(1), so a hand-walked path is microseconds.

Note the cost driver is **sibling width, not depth**: one loreal table has 1,156 element
children, and that document walked 6× slower than the much larger filing despite being
shallower.

**2. Resolve against the pristine tree, before any viewer decoration.**

If the viewer injects wrapper or highlight elements into the iframe DOM before resolving,
child indices shift. This is engine-independent and entirely self-inflicted. Either
resolve all pointers up front, or decorate in a way that does not alter element child
lists (overlay positioned elements rather than wrapping, as `pdfDocumentSurface.js`
already does).

## Two subtrees to treat as non-locatable

- **`<select>`** — the one live Safari/Chrome interop gap. A form control, never a fact
  source.
- **`<template>`** — content lives in a separate DocumentFragment and is invisible to
  `children` and `querySelector` in every browser. It also does not render, so nothing
  locatable lives there.

## What the producer side must do (not the viewer)

Recorded here because a mismatch shows up as *viewer* bugs — pointers that silently
resolve to the wrong element with no error.

Arelle should parse HTML5 sources with **lexbor** (`selectolax`), not `lxml` and not
html5lib. On a 182 MB document: lxml.etree 0.54 s, lexbor 0.93 s, html5lib 23.73 s — and
html5lib matched real Safari on only 91.12% of conformance cases, versus lexbor's 98.38%.
html5lib would produce trees no browser agrees with.

lexbor has one trap: **its scripting flag is off and `selectolax` exposes no way to set
it.** Browsers parse `<noscript>` content as raw text when scripting is enabled; lexbor
parses it as elements, and with `<noscript>` in `<head>` that content escapes into
`<body>`:

```
<head><noscript><p>x</p></noscript></head><body><div id=a><div id=b>

  browsers (this iframe):  body > div#a, div#b
  lexbor:                  body > p, div#a, div#b     <-- every index after shifts by 1
```

The producer-side fix blanks `<noscript>` *content* in the raw bytes pre-parse, keeping
the element so sibling indices are preserved. It must happen pre-parse: once the `<p>` has
escaped into `<body>`, nothing in the tree marks its origin.

If pointers ever appear to be off by one within a container, this is the first thing to
check.

## Still open

With 0.9% of elements in real HTML5 carrying an `id`, pointers land in documents that can
be regenerated independently of the model. A bare child-index path breaks on any editorial
insertion upstream of its target. The PDF surface already solved the analogous problem
with a layered strategy (geometry → token → phrase-locate); the HTML surface will likely
need the same kind of corroboration rather than a purely positional path.
