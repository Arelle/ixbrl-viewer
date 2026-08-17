// See COPYRIGHT.md for copyright information

import { SUPPORTED_TYPES } from "./descriptors.js";

/*
 * Renders a descriptor in the OIM creator's OBJECT_SCHEMAS shape to a form.
 *
 * The renderer is the durable half of the descriptor work and the descriptor
 * itself is the disposable half: this file should not need to change when
 * hand-written descriptors are replaced by generated ones, which is the whole
 * reason for rendering the creator's format rather than a format of our own.
 *
 * Built with plain DOM rather than a template so that a field can be added by
 * the generator without a corresponding HTML edit -- a form whose shape is data
 * cannot also have its shape baked into markup.
 */

/*
 * An unrenderable field is shown as a disabled row naming the type, not
 * skipped.  A generated descriptor that asks for a widget this renderer lacks
 * is a gap to notice, and silently dropping the field would hide the very
 * drift the descriptor pipeline exists to surface.
 */
function unsupportedRow(doc, def) {
    const row = doc.createElement("div");
    row.className = "tagger-field tagger-field-unsupported";
    const label = doc.createElement("label");
    label.textContent = def.label ?? def.key;
    const note = doc.createElement("span");
    note.className = "tagger-field-note";
    note.textContent = `no widget for type "${def.type}"`;
    row.append(label, note);
    return row;
}

function controlFor(doc, def, value) {
    if (def.type === "select") {
        const sel = doc.createElement("select");
        for (const opt of def.options ?? []) {
            const o = doc.createElement("option");
            o.value = opt;
            // The creator's convention: a leading empty option means "unset".
            o.textContent = opt === "" ? "—" : opt;
            sel.appendChild(o);
        }
        sel.value = value ?? "";
        return sel;
    }
    if (def.type === "checkbox") {
        const cb = doc.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!value;
        return cb;
    }
    if (def.type === "textarea") {
        const ta = doc.createElement("textarea");
        ta.rows = 3;
        ta.value = value ?? "";
        return ta;
    }
    const input = doc.createElement("input");
    input.type = (def.type === "number" || def.type === "integer") ? "number" : "text";
    if (def.type === "integer") {
        input.step = "1";
    }
    if (def.type === "qname" || def.type === "sqname") {
        // A QName field is free text until a picker exists; monospace at least
        // signals that it is an identifier rather than prose.
        input.className = "mono";
        input.placeholder = "prefix:name";
    }
    if (def.type === "uri") {
        input.placeholder = "https://";
    }
    input.value = value ?? "";
    return input;
}

/*
 * Render `descriptor` into `container`, seeded from `values`.
 *
 * Returns a handle with read() and a per-field map, so the caller never has to
 * query the DOM it did not build.  onChange fires on every edit, which is what
 * lets a caller keep a live preview -- the tagger re-derives the value from the
 * captured text as the user types a scale.
 */
export function renderForm(container, descriptor, { values = {}, onChange } = {}) {
    const doc = container.ownerDocument;
    container.textContent = "";
    const controls = new Map();

    for (const def of descriptor?.scalar ?? []) {
        if (!SUPPORTED_TYPES.has(def.type)) {
            container.appendChild(unsupportedRow(doc, def));
            continue;
        }
        const row = doc.createElement("div");
        row.className = "tagger-field";

        const label = doc.createElement("label");
        label.textContent = def.label ?? def.key;
        if (def.required) {
            const req = doc.createElement("span");
            req.className = "tagger-field-required";
            req.textContent = "*";
            // Not conveyed by the asterisk alone, which a screen reader may skip
            req.setAttribute("aria-label", "required");
            label.appendChild(req);
        }

        const control = controlFor(doc, def, values[def.key]);
        const id = `tagger-field-${def.key}`;
        control.id = id;
        label.setAttribute("for", id);
        if (def.hint) {
            // The descriptor's hint is the schema's description: it is the one
            // piece of the generated artifact that is purely for the human, so
            // it is surfaced rather than kept as a tooltip only.
            control.title = def.hint;
        }
        if (onChange) {
            control.addEventListener("input", () => onChange(def.key, readControl(control, def), def));
            control.addEventListener("change", () => onChange(def.key, readControl(control, def), def));
        }

        row.append(label, control);
        if (def.hint) {
            const hint = doc.createElement("div");
            hint.className = "tagger-field-hint";
            hint.textContent = def.hint;
            row.appendChild(hint);
        }
        container.appendChild(row);
        controls.set(def.key, { control, def });
    }

    return {
        controls,
        read: () => readForm(controls),
        set: (key, value) => {
            const entry = controls.get(key);
            if (!entry) {
                return;
            }
            if (entry.def.type === "checkbox") {
                entry.control.checked = !!value;
            }
            else {
                entry.control.value = value ?? "";
            }
        },
    };
}

function readControl(control, def) {
    if (def.type === "checkbox") {
        return control.checked;
    }
    const raw = control.value;
    if (raw === "" || raw === null || raw === undefined) {
        return undefined;   // absent, not empty: the model distinguishes them
    }
    if (def.type === "integer") {
        const n = Number(raw);
        return Number.isInteger(n) ? n : raw;
    }
    if (def.type === "number") {
        const n = Number(raw);
        return Number.isFinite(n) ? n : raw;
    }
    return raw;
}

/*
 * Read the form as an object, omitting fields the user left unset.
 *
 * Omission rather than emission of empty values matters: in the model an absent
 * property and a property set to "" are different statements, and writing the
 * second where the user meant the first would add noise to every journal entry.
 */
export function readForm(controls) {
    const out = {};
    for (const [key, { control, def }] of controls) {
        const v = readControl(control, def);
        if (v === undefined || v === "" || (def.type === "checkbox" && v === false)) {
            continue;
        }
        out[key] = v;
    }
    return out;
}
