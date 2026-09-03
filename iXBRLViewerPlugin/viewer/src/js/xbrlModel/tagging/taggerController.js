// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { BindSession, BIND_STATE } from "./bindSession.js";
import { TaggingJournal, VERDICT } from "./journal.js";
import { derivationFieldsFor, FACT_VALUE_DERIVATION } from "./descriptors.js";
import { renderForm } from "./formRenderer.js";

/*
 * Wires the bind card in the inspector to a BindSession and the active document
 * surface.
 *
 * Kept out of inspector.js deliberately: the inspector is a core file the
 * XbrlModel work is trying to stop patching (see REFACTOR-TO-PLUGIN.md), so the
 * tagger's footprint there is a construction and two calls rather than several
 * hundred lines that would have to be unpicked when the plugin extension points
 * land.
 */
export class TaggerController {

    constructor(inspector) {
        this._inspector = inspector;
        this._session = null;
        this.journal = new TaggingJournal({});
        // Named once the document is known, so an exported journal says what it
        // was tagged against rather than arriving anonymous.
        this._namedJournal = false;
    }

    /* The surface currently rendering the document, or null for plain iXBRL. */
    _surface() {
        return this._inspector?._viewer?._surface ?? null;
    }

    initialize() {
        const card = this._card = $("#bind-card");
        this._bar = $("#bind-bar");
        $("#ixv").on("click", ".locate-in-document", () => this.beginBind());
        this._bar.find(".bind-bar-cancel").on("click", () => this._session?.cancel());
        card.find(".bind-cancel").on("click", () => this._session?.cancel());
        card.find(".bind-retry").on("click", () => this._session?.retry());
        card.find(".bind-widen").on("click", () => this._session?.widen());
        card.find(".bind-accept").on("click", () => this._accept());
        card.find(".bind-derivation-toggle").on("click", () => {
            this._showAllDerivation = !this._showAllDerivation;
            this._derivationSignature = null;   // force a re-render
            this._render();
        });
        // Esc leaves bind mode from anywhere, including with focus in the
        // document iframe, which is where it will usually be.
        $(document).on("keydown.tagger", (e) => {
            if (!this._session) {
                return;
            }
            if (e.key === "Escape") {
                this._session.cancel();
                return;
            }
            /*
             * Undo the most recent join.  Guarded on the focused element: the
             * derivation form has text inputs, and stealing ctrl+z there would
             * take away the undo the user actually meant -- the one for what
             * they are typing.
             */
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
                const tag = (document.activeElement?.tagName || "").toLowerCase();
                if (tag === "input" || tag === "textarea" || tag === "select") {
                    return;
                }
                if ((this._session.fragments?.length ?? 0) > 1) {
                    e.preventDefault();
                    this._session.dropFragment();
                }
            }
        });
        $("#export-journal").on("click", () => this._export());
        // The export control appears only once there is something to export,
        // and its count is the running total, so the journal is visible without
        // a panel to review it in -- which is still to be built.
        this.journal.onChange(() => this._updateExport());
        this._updateExport();
        this._updateFactButton();
    }

    _updateExport() {
        const n = this.journal.length;
        $("#ixv").toggleClass("has-journal", n > 0);
        $("#export-journal").attr("title",
            n ? `Export tagging journal (${n} ${n === 1 ? "entry" : "entries"})`
              : "Export tagging journal");
    }

    /*
     * Download the journal.  Deliberately the only way anything leaves the
     * browser: nothing here writes to the model or the document, so the
     * non-mutation invariant stays mechanically true rather than merely
     * intended, and applying the journal is a separate offline step.
     */
    _export() {
        if (!this.journal.length) {
            return;
        }
        const blob = new Blob([this.journal.serialise()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (this.journal.toJSON().document ?? "tagging") + ".journal.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Revoked on a later turn of the event loop: revoking synchronously can
        // race the download the click just started.
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    /*
     * The button reads "Locate" or "Re-locate" depending on whether the fact
     * already has a source, and is hidden entirely when no surface is present
     * so the plain iXBRL viewer is untouched.
     */
    /*
     * Visibility rides on a class on #ixv rather than an inline toggle, because
     * fact-details.html is a template cloned afresh for every fact rendered:
     * toggling the live node only lasts until the next selection re-creates it,
     * hidden again by the stylesheet.  A class on an ancestor survives that.
     */
    _updateFactButton() {
        const fact = this._inspector?._currentItem;
        const usable = !!this._surface() && !!fact;
        $("#ixv").toggleClass("can-tag", usable);
        if (usable) {
            const bound = this._factIsLocated(fact);
            const label = bound ? this._t("tagger.relocate", "Re-locate")
                                : this._t("tagger.locate", "Locate in document");
            // The label goes to the tooltip and the accessible name, never into
            // the button's content: this is an icon button, and setting text
            // would render it beside the glyph and turn a compact affordance
            // back into the full-width block it was moved out of.
            $(".locate-in-document").attr({ title: label, "aria-label": label });
        }
    }

    _t(key, fallback) {
        try {
            // i18next is initialised by the inspector before this runs
            return require("i18next").t(key) || fallback;
        }
        catch {
            return fallback;
        }
    }

    /* A fact is "located" if the document shows it somewhere. */
    _factIsLocated(fact) {
        try {
            return !fact.isHidden?.();
        }
        catch {
            return false;
        }
    }

    factChanged() {
        // Changing the selected fact mid-bind would make the pending journal
        // entry ambiguous about its target, so the bind is abandoned rather
        // than retargeted.
        if (this._session) {
            this._session.cancel();
        }
        this._updateFactButton();
    }

    beginBind() {
        const surface = this._surface();
        const fact = this._inspector?._currentItem;
        if (!surface?.beginBind || !fact) {
            return;
        }
        this._session = new BindSession({
            fact: {
                id: fact.vuid,
                // The model's names for what is being tagged.  The viewer id is
                // a document element id or a position in build order, so it does
                // not survive re-rendering the document -- which is the case a
                // journal is most wanted for, where every fact starts unlocated.
                name: fact.f?.n,
                valueName: fact.f?.fvn,
                // What this occurrence is bound to in the model, so a rebind can
                // record what it displaced.
                currentSources: fact.f?.vs,
                value: this._factValue(fact),
                dataType: this._factDataType(fact),
            },
            surface,
            journal: this.journal,
        });
        if (!this._namedJournal) {
            const params = typeof location !== "undefined"
                ? new URLSearchParams(location.search) : null;
            const doc = params?.get("document");
            const model = params?.get("xbrlModel");
            if (doc || model) {
                // Both, so an exported journal states what it was tagged
                // against as well as what it tagged -- an applier needs the
                // model to resolve the fact ids, and a reviewer needs the
                // document to check the locators.
                this.journal._document = doc ?? this.journal._document;
                this.journal._model = model ?? this.journal._model;
                this._namedJournal = true;
            }
        }
        this._showAllDerivation = false;
        this._derivationSignature = null;
        this._session.onChange(() => this._render());
        this._session.begin();
        $("#ixv").addClass("bind-mode");
        this._renderTarget(fact);
    }

    _factValue(fact) {
        try {
            return String(fact.value?.() ?? "");
        }
        catch {
            return "";
        }
    }

    _factDataType(fact) {
        try {
            return fact.concept?.()?.dataType?.()?.name ?? null;
        }
        catch {
            return null;
        }
    }

    _renderTarget(fact) {
        let label = fact.vuid;
        try {
            label = fact.getLabel("std") || fact.conceptName?.() || label;
        }
        catch { /* fall back to the id */ }
        this._card.find(".bind-concept").text(label);
        this._card.find(".bind-expected-value").text(this._factValue(fact));
        // The bar names the target too: it is the part of the signal that stays
        // on screen when the card scrolls away, and a mode indicator that does
        // not say what it is operating on is only half a signal.
        this._bar.find(".bind-bar-target").text(label);
    }

    _render() {
        const s = this._session;
        if (!s || s.state === BIND_STATE.IDLE) {
            $("#ixv").removeClass("bind-mode");
            this._session = null;
            this._updateFactButton();
            return;
        }
        const shown = s.captured ?? s.current;
        const card = this._card;
        card.find(".bind-hint").toggle(!shown);
        card.find(".bind-captured").toggle(!!shown);
        card.find(".bind-captured-text").text(this._forDisplay(shown?.text));

        card.find(".bind-verdict")
            .text(shown ? this._verdictText(shown.verdict) : "")
            .attr("data-verdict", shown?.verdict ?? "");

        this._renderFragments(s, shown);
        card.find(".bind-derivation").text(shown ? this._derivationText(shown.derivation) : "");
        card.find(".bind-unverified").text(shown?.unverified ?? "");
        this._renderDerivationForm(shown);

        card.find(".bind-widen").prop("disabled", !shown?.widenTo);
        card.find(".bind-retry").prop("disabled", s.state !== BIND_STATE.CAPTURED);
        card.find(".bind-accept").prop("disabled", !s.canAccept());
    }

    /*
     * Render the derivation fields this capture puts in play, if any.
     *
     * Re-rendered only when the implicated field set changes, not on every
     * state emission: rebuilding the DOM under the user's cursor would discard
     * a half-typed scale and move focus out of the box they are typing into.
     */
    _renderDerivationForm(shown) {
        const host = this._card.find(".bind-derivation-form").get(0);
        if (!host) {
            return;
        }
        /*
         * By default only the fields this capture implicates.  The toggle opens
         * the whole descriptor, because the subset answers "what is wrong here"
         * and cannot answer "I want to set escape anyway" -- an agreeing capture
         * implicates nothing, and would otherwise offer no way in at all.
         */
        const auto = shown ? derivationFieldsFor(shown.verdict, shown.derivation) : null;
        const fields = !shown ? null
            : this._showAllDerivation
                ? { descriptor: FACT_VALUE_DERIVATION, values: auto?.values ?? {}, alternatives: auto?.alternatives ?? [] }
                : auto;
        this._card.find(".bind-derivation-toggle").toggle(!!shown)
            .text(this._showAllDerivation ? "Only what needs correcting" : "All derivation properties");
        const signature = fields
            ? (this._showAllDerivation ? "all|" : "auto|")
              + fields.descriptor.scalar.map(f => f.key).join(",") + "|" + JSON.stringify(fields.values)
            : "";
        if (signature === this._derivationSignature) {
            return;
        }
        this._derivationSignature = signature;
        if (!fields) {
            host.textContent = "";
            this._derivationForm = null;
            $(host).hide();
            return;
        }
        $(host).show();
        this._derivationForm = renderForm(host, fields.descriptor, { values: fields.values });
        if (fields.alternatives?.length) {
            const alt = this._card.find(".bind-derivation-alt").get(0);
            if (alt) {
                alt.textContent = "also fits: " + fields.alternatives.map(s =>
                    [s.scale != null ? `scale ${s.scale}` : null,
                     s.sign ? "negated" : null].filter(Boolean).join(" + ")).join("; ");
            }
        }
        else {
            this._card.find(".bind-derivation-alt").text("");
        }
    }

    /*
     * List the joined fragments once there is more than one, so a value
     * assembled from several runs shows what it was assembled from -- otherwise
     * the concatenated text is the only evidence, and a wrong fragment is
     * invisible.
     */
    _renderFragments(session, shown) {
        const frags = session?.fragments ?? [];
        const el = this._card.find(".bind-fragments").empty();
        if (frags.length < 2) {
            return;
        }
        // Each fragment is removable, and any of them rather than only the last:
        // joins are built left to right, so the wrong one is often not the most
        // recent, and unwinding good fragments to reach a bad one is worse than
        // the mistake.
        frags.forEach((f, i) => {
            const chip = $('<span class="bind-fragment"></span>').appendTo(el);
            $('<span class="bind-fragment-text"></span>')
                .text(this._forDisplay(f.text) || "(whitespace)").appendTo(chip);
            $('<button class="bind-fragment-remove"></button>')
                .attr({ title: "Remove this fragment", "aria-label": `Remove fragment ${i + 1}` })
                .text("\u00d7")
                .on("click", () => this._session?.removeFragment(i))
                .appendTo(chip);
        });
    }

    /*
     * Collapse whitespace for display only.  The captured text keeps whatever
     * the document had, because that is what concatenates into the value; a
     * card that showed the raw text would render a text block's newlines and
     * indentation as a wall of space.
     */
    _forDisplay(text) {
        return (text ?? "").trim().replace(/\s+/g, " ");
    }

    _verdictText(verdict) {
        switch (verdict) {
            case VERDICT.AGREE:  return "matches the fact value";
            case VERDICT.COARSE: return "contains the value, plus more — try a narrower click";
            case VERDICT.PARTIAL: return "only the start of the value — shift-click the rest to join it";
            case VERDICT.DIFFER: return "differs from the fact value";
            default: return "";
        }
    }

    /*
     * Worded to distinguish what was solved from what was merely shortlisted:
     * a scale is arithmetic, a transform shortlist is a guess narrowed by
     * pattern, and presenting them alike would overstate the second.
     */
    _derivationText(d) {
        if (!d) {
            return "";
        }
        switch (d.kind) {
            case "solved": {
                const parts = d.solutions.map(s =>
                    [s.scale != null ? `scale ${s.scale}` : null,
                     s.sign ? "negated" : null].filter(Boolean).join(" + "));
                return `would match with ${parts.join("  or  ")}`;
            }
            case "shortlist":
                return `could be ${d.solutions.map(s => s.transformation).join(", ")} (not verified)`;
            case "unrelated":
                return "no scaling relates these values — likely the wrong content";
            default:
                return "";
        }
    }

    /*
     * Accepting emits a DOM event carrying the entry and the journal's new
     * size.  The journal is deliberately not reachable from a global, so this
     * is how anything outside the controller -- a future review panel, an
     * export button, an end-to-end test -- observes that a bind landed.
     */
    _accept() {
        // Binding a value and saying how it derives are one decision -- "this
        // text, derived this way, is the value" -- so they become one journal
        // entry rather than a bind followed by an edit.
        const derivation = this._derivationForm?.read();
        const entry = this._session?.accept(
            derivation && Object.keys(derivation).length ? { derivation } : {});
        if (!entry) {
            return;
        }
        this._inspector?._iv?.setProgress?.(`Bound ${entry.factId}`);
        document.dispatchEvent(new CustomEvent("xbrl-bind-accepted", {
            detail: { entry, journalLength: this.journal.length },
        }));
    }
}
