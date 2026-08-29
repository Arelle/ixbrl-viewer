# Handover: resolving xbrlx pointer locators in the viewer

For the session that owns `htmlDocumentSurface.js` and `tagging/`.

Arelle now **produces** `xbrlx:htmlElementPointer` + `xbrlx:htmlTextOffset` +
`xbrlx:htmlTextQuote` locators, from `arelle/plugin/XbrlModel/tools/alignFactsToPdf.py`
(`--html5`). The viewer writes pointers but has no path that reads them, so the
round trip is unproven in both directions. Written 2026-08-21 by the session that
built the producer side.

---

## 1. What already agrees — do not "fix" these

Checked before writing this, because the risk here is silent divergence:

- **The fragment encoding matches.** `mergeSources` in `tagging/bindSession.js`
  gathers collection properties into ordered arrays and writes scalars once.
  That is exactly what the Arelle emitter produces: one `valueSource` whose
  arrays are parallel, fragment *i* being `pointer[i]` / `offset[i]` / `quote[i]`.
- **The pointer algorithm matches.** `HtmlElementPointer.py` is a port of
  `tagging/elementPointer.js` and round-trips 8381/8381, 1434/1434 and
  67801/67801 elements across the corpus documents.
- **The locator-type split matches.** `_locatorType(doc)` keys off
  `document.contentType`; Arelle keys off a required `mediaType` argument. Same
  two types, same meaning.

## 2. What does not agree yet

> **Done 2026-08-21** (commit `42a0b5df`), by the session this note was addressed
> to. All three items below are closed; the section is kept because the reasoning
> is what the code now depends on.
>
> - 2.1 the four refinement properties are in `COLLECTION_PROPERTIES`;
> - 2.2 `tagging/resolveLocator.js` resolves a stored locator to a DOM Range,
>   walking `children[i]` and offering `resolveAll()` for pristine-tree
>   resolution;
> - 2.3 `_candidateFor` takes the click's Range, so a number inside prose is
>   addressable — verified on `msft-ar25-html5.html`, where a paragraph holds
>   four numbers and clicking the second yielded pointer
>   `shareholder-letter/3/3`, offset 81, quote `"15"`, which resolves back to
>   exactly `"15"`.
>
> Not done: the corpus was used as *input* only. Nothing was added to
> `expected-pointers.json`, which §5 describes as a mirror of the Arelle copy —
> so offset/quote expectations, if they should be shared cross-language too, still
> have to start from the Arelle-side generator.

### 2.1 `COLLECTION_PROPERTIES` is missing the new properties

`tagging/bindSession.js` has:

```js
const COLLECTION_PROPERTIES = new Set([
    "xbrl:htmlElementId", "xbrl:pdfMcid", "xbrlx:htmlElementPointer",
]);
```

`xbrlx:htmlTextOffset`, `xbrlx:htmlTextQuote`, `xbrlx:pdfTextOffset` and
`xbrlx:pdfTextQuote` are all `xbrlr:stringCollection` in `resources/xbrlx.json`
as of 2026-08-21. Absent from this set, `mergeSources` keeps `vals[0]` and
**silently drops every fragment after the first** for a value split across
elements. Latent until the tagger emits offsets, which is 2.3.

### 2.2 Nothing resolves a pointer

`resolvePointer` exists in `elementPointer.js` and is used only by
`verifiedPointer` at capture time. No display path consumes a stored locator, so
a model carrying pointer locators cannot be viewed. This is the main piece of
work.

Two rules from `HTML5-LOCATORS.md`, which is the companion note:

- Walk `children[i]`; never hand a child sequence to `querySelector`
  (43.8 s vs 0.78 µs on a 1.08 M-element document).
- Resolve against the **pristine** tree, before any viewer decoration. Injected
  wrapper elements shift child indices. `pdfDocumentSurface.js` already overlays
  rather than wrapping; do the same here.

### 2.3 The tagger cannot address a number inside prose

`_candidateFor` records a pointer and the element's whole `textContent`. On a
legacy inline document that is exact, because every fact has its own `ix:`
element. On an HTML5 report it is not: **27%** of the numbers in
`msft-ar25-html5.html` share an element with another number, worst case a `<p>`
holding 14 of them. A pointer alone cannot say which number is the fact.

The capture flow needs the offset and quote that the Arelle side emits. The
browser gives you this nearly free — `window.getSelection()` /
`Range.startOffset` on the clicked text node — where Arelle had to derive it
from a token alignment.

## 3. The offset convention, exactly

Arelle emits, per fragment:

| property | value |
|---|---|
| `xbrlx:htmlElementPointer` | pointer to the text node's **immediate parent** element |
| `xbrlx:htmlTextOffset` | 0-based character offset into that element's `textContent` |
| `xbrlx:htmlTextQuote` | the exact source text, unstripped and uncollapsed |

`textContent` means what the DOM means: all descendant text in document order,
comments contributing nothing. The end of the value is `offset + quote.length`.
Text is never stripped or whitespace-collapsed — collapsing belongs to the
transform stage, which `_candidateFor` already gets right for `text`.

To resolve to a DOM `Range`: resolve the pointer to an element, then walk its
text nodes accumulating lengths until the offset falls inside one. Verify by
comparing the resulting text against `htmlTextQuote` and refusing to highlight on
mismatch — the quote exists so that a regenerated document is detected rather
than silently mis-highlighted.

## 4. Why the offset exists at all

A locator that names only a container cannot feed a fact's `transformation`. On
the PDF surface the same problem is sharper: `xbrl:pdfBBox` locates a rectangle,
so there is no source text at all, and **1112 of the 1161** bbox-located facts in
the Microsoft run carry a transformation. Both surfaces are therefore moving to
container + offset — `xbrlx:pdfTextLocatorType` is the PDF counterpart, declared
in the same file. `pdfBBox` remains permitted as a highlight hint.

That symmetry is worth preserving in the viewer: one resolution shape, two
surfaces.

## 5. The shared corpus

`§4.1` of the Arelle-side handover asks for a corpus asserted from **both**
languages rather than two implementations believed to match. It is generated —
0.73 MB, complete for both HTML5 documents plus a deterministic sample of the
67k-element filing, covering all three pointer forms, carrying raw and
post-normalization sha256 so you know you are parsing identical bytes:

```
/private/tmp/claude-501/-Users-hermf-Documents-projects-Arelle-ArelleProject-hermfischer-xb/b6e29230-f100-466f-9724-d962219f9061/scratchpad/elementPointer-corpus.json
```

It has **no home yet**; Herm has the placement decision. A JS test should parse
each named document, walk elements in document order, and assert
`elementPointer(el, doc) === pointers[i]`.

**Before parsing any `text/html` document, apply the noscript normalization** —
`arelle/plugin/XbrlModel/Html5Normalize.py`, `normalizeNoscript`. Both
demonstration documents leak analytics markup out of `<noscript>` under a
scripting-disabled parser (a Webtrends pixel and a GTM iframe, both near the top
of `<body>`), shifting every index after them. The corpus sha256s are recorded
both raw and normalized for this reason. In a browser the iframe parse is already
scripting-enabled, so this applies to the *Node/jsdom* side of the assertion, not
to the viewer at runtime.

## 6. Producer-side state, for reference

- `1725 / 1800` facts located in `msft-ar25-html5.html`, 70 spanning more than
  one element, 0 pointers failing verification, and every emitted quote
  reproduces the fact's source text exactly.
- A fact whose tokens only partially align is **rejected**, not emitted — a
  locator addressing `"2025"` where the value is `"June 30, 2025"` resolves to
  real text and reads as a success.
- `loreal-ar25-html5.html` does not align: a 1346-token summary page against a
  347543-token filing, overlapping in 192 tokens, whose figures match only after
  scale and rounding. A different problem, recorded in `§8` of the Arelle note.
- The PDF emitter for `xbrlx:pdfTextOffset` is not written yet. The
  marked-content text fix it was waiting on has landed (commit 40afce203, a
  q/Q graphics-state bug in `PdfTextExtractor.py`), taking PDF fact location
  from 84% to 93%. Re-measured after it, **772 of 1034 row placements (75%)**
  are cases that text-offset addressing dissolves rather than whole-MCID
  addressing, so the PDF surface will lean on offsets at least as heavily as
  the HTML5 one.
- One invariant to assert rather than assume when writing either resolver: a
  text offset is only meaningful if the string the emitter counted and the
  string the viewer resolves are the same string. On the PDF side this was
  checked -- every invisible (`Tr 3`) run lies outside BDC and every in-MCID run
  is visible, so no hidden layer is interleaved into the text those offsets are
  counted over. On the HTML side the equivalent is `textContent` with comments
  contributing nothing, which is what section 3 specifies.
