# Instance tagger — proof of concept

Turns the XbrlModel overlay from a viewer into an editor: bind a fact in the
model to the place in the source document its value comes from, without modifying
the source document.

**Status:** PoC increment 1 — bind/rebind on both the PDF and HTML surfaces,
journal-only (no persistence).

### Build status

Bind and rebind work end to end on both surfaces, a captured locator can be read
back, and the journal can be exported. What remains is a review surface for the
journal and the editing work listed below.

| | module | verified by |
|---|---|---|
| ✅ | `tagging/journal.js` — the edit journal, verdicts | 25 tests |
| ✅ | `tagging/derive.js` — solve scale/sign, shortlist transforms | 23 tests |
| ✅ | `tagging/hitIndex.js` — banded hit-testing for PDF | 18 tests |
| ✅ | `tagging/elementPointer.js` — XPointer element() for HTML | 17 tests + all 90,908 elements of the L'Oreal filing round-trip |
| ✅ | `tagging/bindSession.js` — the bind lifecycle, surface-agnostic | 33 tests |
| ✅ | `tagging/formRenderer.js` — forms from a creator-shaped descriptor | 13 tests + all 33 creator object types render |
| ✅ | `tagging/descriptors.js` — the factValue derivation stand-in, and the per-capture subset | 11 tests |
| ✅ | `beginBind` / `endBind` / `widen` on both surfaces | driven in a browser on the loreal PDF and XHTML |
| ✅ | the bind card, the trigger, and mode signalling | as above |
| ✅ | multi-fragment capture, with per-fragment undo | 11 tests |
| ✅ | `tagging/resolveLocator.js` — read a stored locator back to a DOM Range | 22 tests + a live round trip on the Microsoft HTML5 report |
| ✅ | capture a number *inside* prose, via the click's Range | as above |
| ✅ | journal export (download) | driven in a browser |
| ⬜ | auto-extend a partial capture to its remaining runs | — |
| ⬜ | journal *review* — list, inspect and undo entries in a panel | — |
| ⬜ | the pencil: the full derivation descriptor, outside a bind | — |

The pure modules are deliberately free of DOM, viewer and model references,
which is why they can be tested without a browser. The wiring cannot be, and is
verified with puppeteer against the demo documents instead — which is how three
faults were found that unit tests could not reach: the trigger never appearing
because the fact pane is re-rendered from a template, the candidate going stale
when the cursor left the document, and an unbounded expected value making the
card taller than the panel.

### Reading a locator back

A locator is only half useful if nothing consumes it. `tagging/resolveLocator.js`
resolves a stored one to a DOM Range, which is what lets a model carrying pointer
locators be *viewed* rather than only written.

A pointer alone is not enough on HTML5: 27% of the numbers in Microsoft's annual
report share an element with another number, one `<p>` holding fourteen. So a
locator carries three parallel arrays — fragment *i* is `pointer[i]` /
`offset[i]` / `quote[i]` — where the pointer names the text node's immediate
parent, the offset is 0-based into that element's `textContent`, and the quote is
the exact source text.

The quote is checked before highlighting and a mismatch **refuses**. That is why
it is stored: a document regenerated since the model was written still resolves
its pointer to a real element, and highlighting it would assert a fact sits
somewhere it does not.

Capture is the same convention in reverse. A click captures the run of non-space
characters around the caret rather than the whole element — whitespace-delimited
rather than number-aware, because "41 182,5" is one number written with a space
and "(1,646)" is a value including its parentheses — and dragging states an
explicit extent.

### Mode signalling

Bind mode intercepts clicks, so it has to be unmistakable. The conventional
scrim is the wrong instrument: dimming content reads as "this is inactive",
which is the opposite of what bind mode means — the document is the one surface
that *is* live. So the document pane is marked as **armed** (accent outline, and
a bar naming the fact being located) and the inspector is **shaded** instead.

Shaded rather than faded: reducing opacity costs contrast on the fact details
still being read during a bind, not least the expected value being compared
against. A background shade marks the surface inactive and leaves text alone.

The signal is never colour alone — the bar states the target in text, so it
survives dark mode and colour vision deficiency. The bar also carries Cancel,
the one control that must stay reachable when the card scrolls out of view;
`Esc` does the same but is invisible.

Accept and Cancel stay in the card rather than moving to a corner in the
phone-edit-mode idiom. On a phone those live in the nav bar because the mode
owns the whole screen; here attention is already on the card, which holds the
captured text and verdict being acted on, and splitting a decision from its
evidence would be worse.

---

## 1. Scope of increment 1

| in | out (later increments) |
|---|---|
| PDF documents (`pdfContentLocatorType`, `pdfImageLocatorType`) | — |
| HTML/XHTML documents (`htmlElementId`, `htmlElementPointer`) | — |
| Facts already in the model that have **no** location | Creating facts that are not in the model |
| Re-locating a fact that is located **wrongly** | Creating concepts, dimensions, members |
| **Value-derivation** properties: `transformation`, `scale`, `sign`, `escape`, `decimals` | **Fact-identity** properties: `factDimensions`, `factQualifier`, period, entity |
| Emitting an edit **journal** the user downloads | Writing back to the model / server |
| Several fragments joined into one value | — |

The deliberate constraint is that increment 1 **cannot create or destroy model
content**. It only answers "where does this fact's value come from, and how is
that text converted into the asserted value?" for facts the model already
asserts. That keeps the blast radius small and makes the output reviewable.

### 1.1 Why both surfaces from the start

An earlier draft scoped increment 1 to PDF alone, on the grounds that the PDF
seam was readier. That was wrong on two counts.

Practically, `htmlDocumentSurface.js` already exists and the HTML bind gesture is
*simpler* than the PDF one — the click target is a DOM element rather than a
hit-tested glyph rectangle.

More importantly, a PDF-only proof of concept invites the work to be dismissed on
provenance rather than judged on merit. Fact tagging in HTML is the incumbent
practice; a tool that only does PDF reads as an argument for PDF rather than as a
tagging tool. Supporting both from the first demo removes that reading entirely,
and costs little.

### 1.2 Locator types the PoC declares ahead of the spec

Three locator declarations are added to the plugin's `core.json` before the spec
settles them. Two of them merely declare what already works, and the third is the
subject of an open proposal:

| declaration | status |
|---|---|
| `xbrl:pdfImageLocatorType` (`pdfPage` + `pdfBBox` + optional `pdfImageHash`) | documented, emitted by `alignFactsToPdf`, consumed by `adapter.js` — but never declared |
| `xbrl:pdfBBox` in `pdfContentLocatorType.allowedProperties` | sub-MCID glyph rectangles the aligner already emits would otherwise fail `allowedProperties` |
| `xbrl:htmlElementPointer` + `xbrl:xhtmlPointerLocatorType` | proposed in `documentation/proposal-html-element-pointer.md` (OIM repo) |

The first two are corrections: working code has outrun the declared model, and the
tagger will *generate* these properties rather than only read them, so they have
to be declarable before it writes anything.

The third is deliberately ahead of the spec. A working demonstration of tagging an
element that has no `id`, in a document that is never modified, is a far stronger
argument for the proposal than the proposal document is. It is marked in
`core.json` as provisional so it can be renamed or withdrawn without ceremony.

## 2. Why the unlocated facts are the right starting worklist

The adapter already keys any fact carrying no document locator as `hf-N` and the
surface registers it as a hidden fact (`adapter.js`, "No document locator at all").
The Overview panel counts them.

That count is exactly "facts the model asserts but cannot point at in this
document" — a ready-made, finite, user-meaningful worklist. Increment 1 does not
have to invent a queue; it has to make the existing one actionable.

Two populations end up there, and the UI should distinguish them:

- **Genuinely unlocatable** — `ix:hidden` facts such as `dei:EntityCentralIndexKey`,
  which have no display text by design. These should be dismissible, not tagged.
- **Failed to locate** — a fact whose value does appear in the document, but which
  `alignFactsToPdf` could not match. These are the tagging targets.

## 3. User operation

### 3.1 Entering bind mode

1. The user opens the **Tag** panel (a new inspector mode, gated on the model
   being editable) which lists the unlocated facts: concept label, value, and
   the reason it is unlocated where known.
2. Selecting one shows it in the fact detail pane as usual, plus a **Locate in
   document** button.
3. Pressing it enters **bind mode**. The document pane dims slightly, a banner
   names the fact being located and its expected value, and the cursor becomes a
   crosshair. `Esc` leaves bind mode at any point.

Rebind is the same flow entered from a *located* fact, via **Re-locate**; the
existing binding is shown struck through in the banner until the new one is
accepted.

### 3.2 Selecting the target

While in bind mode, moving over the page highlights the **marked-content run**
under the cursor — the same granularity the viewer already highlights facts at.
This works for untagged content because `mcidRects` and `mcidText` are built for
every marked-content id during page render, not only for ones a fact uses.

The candidate highlight shows the text that would be captured, so the user sees
what they are about to bind before committing.

Clicking captures the candidate. Increment 1 captures exactly one run; a run that
is coarser than the value (a whole table row, say) is reported as a mismatch in
the next step rather than silently accepted.

### 3.3 Confirming

A confirmation strip shows, side by side:

| | |
|---|---|
| **fact value** | what the model asserts, formatted as the viewer would show it |
| **captured text** | the text of the marked-content run just clicked |
| **verdict** | one of four |

| verdict | meaning | remedy |
|---|---|---|
| `agree` | the capture matches the value | — |
| `partial` | the capture is the *start* of the value | shift-click the rest to join it |
| `coarse` | the run holds the value *plus more* | click something narrower |
| `differ` | neither | re-capture, or set a derivation |

`partial` and `coarse` are mirrors and need opposite remedies, which is why they
are named separately rather than both reported as a mismatch: a number set with
the thousands separator as a gap can occupy two marked-content runs, so one
click reaches half a value and the capture is right as far as it goes.

The verdict is advisory, never blocking — a value can legitimately differ from its
presentation (scaling, sign, formatting, a `1 234,5` locale form). The user
accepts, retries, or cancels. Accepting appends to the journal and immediately
re-renders the fact as located, so the effect is visible on the page.

The comparison reuses the same normalisation the aligner uses for its token
strategy, so what the tagger calls "agree" matches what `alignFactsToPdf` would
have called a hit.

### 3.4 Reviewing and exporting

The Tag panel doubles as the review surface: it lists journal entries in order,
each showing the fact, the captured location, and the verdict at capture time.
An entry can be undone, which pops it and restores the previous state.

**Export** downloads the journal as JSON. Increment 1 stops there — applying the
journal to the model is a separate, offline step (`XbrlModel` plugin side), which
keeps the browser free of any write path to the user's files.

## 4. The journal

One entry per user decision, not per resulting model mutation. The journal is the
unit of review, so it records *what the user did*, and the applier derives the
model change.

```json
{
  "journalVersion": 1,
  "document": "lor.pdf",
  "model": "loreal-complete.json",
  "entries": [
    {
      "op": "bindValueSource",
      "factId": "f-00317",
      "factName": "msft:fs_F_bc502677-3104-4ca9-95e8-829c07f0ef75",
      "factValueName": "msft:F_bc502677-3104-4ca9-95e8-829c07f0ef75_val",
      "previous": null,
      "locatorType": "xbrl:pdfContentLocatorType",
      "sources": [
        { "properties": [
            { "property": "xbrl:pdfPage", "value": "292" },
            { "property": "xbrl:pdfMcid", "value": "418" }
        ] },
        { "properties": [
            { "property": "xbrl:pdfPage", "value": "292" },
            { "property": "xbrl:pdfMcid", "value": "419" }
        ] }
      ],
      "derivation": { "scale": 6 },
      "capturedText": "41 182,5",
      "factValue": "41182500000",
      "verdict": "agree"
    }
  ]
}
```

Notes on the shape:

- `sources` is an **ordered list** of `factValueSourceObject`s, matching
  `factValue.valueSources`, whose fragments contribute *by concatenation*. A
  number set with the thousands separator as a gap can occupy two
  marked-content runs, so one value legitimately has several sources; a single
  bag is accepted as the one-fragment shorthand and wrapped. Each element is
  already in model form, so the applier attaches rather than translates.
- **`factName` is what an applier resolves against**, not `factId`. The viewer
  keys a located fact by its document element id, but a fact it could not locate
  or placed on a PDF gets a synthesised `hf-N` / `pf-N` — a position in build
  order, not an identity, and one that does not survive re-rendering the
  document. That is exactly the case a journal is most wanted for, where every
  fact starts unlocated, so an entry names the fact as the *model* names it.
  `factId` stays, because within a session it is what the viewer's own undo and
  rebind lookups use.
- `factValueName` is the **occurrence** being bound. A `factValue` is one
  occurrence of the fact in the document rather than one value of it: Microsoft's
  total revenue has four, on pages 49, 84 (twice) and 85. They agree on the
  value — as they must, being one fact — while differing in how it is presented,
  and `us-gaap:CommercialPaper` is printed in millions in one place and billions
  in another. These are *consistent duplicates* in the specification's sense.

  The adapter builds one viewer fact per occurrence, so there is exactly one
  factValue to name and no choice left for the applier to make. Both names are
  `null` for a report with no model behind it (the plain iXBRL path), which tells
  an applier there is no name rather than leaving it to guess.
- `derivation` is present only where the user accepted one — how the located
  text becomes the asserted value, as `scale` / `sign` / `transformation`.
- `previous` is `null` for a bind and carries the displaced sources for a
  rebind, which is what makes an entry reversible. It is in the same shape as
  `sources` — the model's own `factValueSourceObject`s — so reversing an entry is
  a swap rather than a translation. A binding made earlier in the same session
  takes precedence over the model's original, being what is actually in force;
  reversing to the model's would undo more than the entry did.
- `capturedText`, `factValue` and `verdict` are provenance, not instructions. They
  let a reviewer see why the user accepted a binding without re-running the tool,
  and they let the applier warn if the document has changed since.

## 5. What increment 1 deliberately does not do

- **No write path from the browser.** The journal is downloaded; nothing mutates
  the model or the document in place. This keeps the non-mutation invariant
  (§ the `htmlElementPointer` proposal) mechanically true rather than merely
  intended.
- **No concept creation.** A fact with no matching concept is out of scope; that
  needs the schema-driven object forms and belongs with the creator work.
- **No HTML.** The HTML path needs `xbrl:htmlElementPointer` to land first,
  because binding to an element that has no `id` is exactly the case the current
  locator types cannot express without modifying the source.

## 6. Next increments (sketch)

2. **Auto-extend** — where a capture is a proper prefix of the value, try the
   adjacent runs and offer the completion, instead of leaving the user to
   shift-click each one. The `partial` verdict is the signal it keys off. Worth
   building only if shift-click proves tedious in practice.
3. **The pencil** — the complete derivation descriptor from the Properties pane,
   outside a bind, for a fact that is correctly located and merely has the wrong
   scale. Better after the descriptor generator is settled, so a descriptor is
   not hand-maintained twice.
4. **Propose mode** — run the aligner against a prior-year model and render its
   output as *proposed* bindings the user confirms or corrects, rather than facts
   the user must locate from scratch. The review UI is the one built here; only
   the queue's origin changes.
5. **Apply** — an `XbrlModel` CLI step that consumes the journal and emits an
   updated model, with validation.
