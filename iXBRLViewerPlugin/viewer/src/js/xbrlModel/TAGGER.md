# Instance tagger — proof of concept

Turns the XbrlModel overlay from a viewer into an editor: bind a fact in the
model to the place in the source document its value comes from, without modifying
the source document.

**Status:** PoC increment 1 — PDF bind/rebind, journal-only (no persistence).

---

## 1. Scope of increment 1

| in | out (later increments) |
|---|---|
| PDF documents (`pdfContentLocatorType`) | HTML documents |
| Facts already in the model that have **no** location | Creating facts that are not in the model |
| Re-locating a fact that is located **wrongly** | Creating concepts, dimensions, cubes |
| Emitting an edit **journal** the user downloads | Writing back to the model / server |
| One fragment per fact | Multi-fragment (text block) binds |

The deliberate constraint is that increment 1 **cannot create or destroy model
content**. It only answers "where does this fact's value come from?" for facts the
model already asserts. That keeps the blast radius small and makes the output
reviewable: a journal of location assertions, nothing else.

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
| **verdict** | agree / differ / captured run is coarser |

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
      "previous": null,
      "locatorType": "xbrl:pdfContentLocatorType",
      "properties": [
        { "property": "xbrl:pdfPage",  "value": "292" },
        { "property": "xbrl:pdfMcid",  "value": "418" }
      ],
      "capturedText": "84,5",
      "factValue": "84.5",
      "verdict": "agree"
    }
  ]
}
```

Notes on the shape:

- `properties` is already in `factValueSourceObject` form — a bag of
  `propertyObject`s validated against the locator type's `requiredProperties` /
  `allowedProperties`. The applier does not have to translate, only to attach.
- `previous` is `null` for a bind and carries the displaced properties for a
  rebind, which is what makes an entry reversible.
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

2. **Multi-fragment binds** — shift-click successive runs; `valueSources`
   concatenate by definition, so text blocks need no new model concept.
3. **HTML bind** — on `xbrl:htmlElementPointer`, with the round-trip verification
   the proposal requires.
4. **Propose mode** — run the aligner against a prior-year model and render its
   output as *proposed* bindings the user confirms or corrects, rather than facts
   the user must locate from scratch. The review UI is the one built here; only
   the queue's origin changes.
5. **Apply** — an `XbrlModel` CLI step that consumes the journal and emits an
   updated model, with validation.
