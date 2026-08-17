// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { BindSession, BIND_STATE } from "./bindSession.js";
import { TaggingJournal, VERDICT } from "./journal.js";

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
    }

    /* The surface currently rendering the document, or null for plain iXBRL. */
    _surface() {
        return this._inspector?._viewer?._surface ?? null;
    }

    initialize() {
        const card = this._card = $("#bind-card");
        $("#ixv").on("click", ".locate-in-document", () => this.beginBind());
        card.find(".bind-cancel").on("click", () => this._session?.cancel());
        card.find(".bind-retry").on("click", () => this._session?.retry());
        card.find(".bind-widen").on("click", () => this._session?.widen());
        card.find(".bind-accept").on("click", () => this._accept());
        // Esc leaves bind mode from anywhere, including with focus in the
        // document iframe, which is where it will usually be.
        $(document).on("keydown.tagger", (e) => {
            if (e.key === "Escape" && this._session) {
                this._session.cancel();
            }
        });
        this._updateFactButton();
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
            $(".locate-in-document").text(
                bound ? this._t("tagger.relocate", "Re-locate")
                      : this._t("tagger.locate", "Locate in document"));
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
                value: this._factValue(fact),
                dataType: this._factDataType(fact),
            },
            surface,
            journal: this.journal,
        });
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
        card.find(".bind-captured-text").text(shown?.text ?? "");

        card.find(".bind-verdict")
            .text(shown ? this._verdictText(shown.verdict) : "")
            .attr("data-verdict", shown?.verdict ?? "");

        card.find(".bind-derivation").text(shown ? this._derivationText(shown.derivation) : "");
        card.find(".bind-unverified").text(shown?.unverified ?? "");

        card.find(".bind-widen").prop("disabled", !shown?.widenTo);
        card.find(".bind-retry").prop("disabled", s.state !== BIND_STATE.CAPTURED);
        card.find(".bind-accept").prop("disabled", !s.canAccept());
    }

    _verdictText(verdict) {
        switch (verdict) {
            case VERDICT.AGREE:  return "matches the fact value";
            case VERDICT.COARSE: return "contains the value, plus more — try Widen’s opposite, or a narrower click";
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
        const entry = this._session?.accept();
        if (!entry) {
            return;
        }
        this._inspector?._iv?.setProgress?.(`Bound ${entry.factId}`);
        document.dispatchEvent(new CustomEvent("xbrl-bind-accepted", {
            detail: { entry, journalLength: this.journal.length },
        }));
    }
}
