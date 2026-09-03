// See COPYRIGHT.md for copyright information

import { renderForm } from "./formRenderer.js";
import { FACT_VALUE_DERIVATION } from "./descriptors.js";

function container() {
    const d = document.createElement("div");
    document.body.appendChild(d);
    return d;
}

/* A descriptor exercising every widget, in the creator's OBJECT_SCHEMAS shape. */
const ALL_TYPES = {
    scalar: [
        { key: 'aText', label: 'A Text', type: 'text' },
        { key: 'aNumber', label: 'A Number', type: 'number' },
        { key: 'anInteger', label: 'An Integer', type: 'integer' },
        { key: 'aCheckbox', label: 'A Checkbox', type: 'checkbox' },
        { key: 'aSelect', label: 'A Select', type: 'select', options: ['', 'x', 'y'] },
        { key: 'aQname', label: 'A QName', type: 'qname', required: true },
        { key: 'aUri', label: 'A URI', type: 'uri' },
        { key: 'aTextarea', label: 'A Textarea', type: 'textarea' },
    ],
    arrays: [],
};

describe("renderForm", () => {
    test("renders one row per scalar field", () => {
        const c = container();
        renderForm(c, ALL_TYPES);
        expect(c.querySelectorAll(".tagger-field").length).toBe(8);
    });

    test("maps the creator's widget vocabulary onto controls", () => {
        const c = container();
        const form = renderForm(c, ALL_TYPES);
        const tag = k => form.controls.get(k).control.tagName.toLowerCase();
        expect(tag('aText')).toBe('input');
        expect(tag('aSelect')).toBe('select');
        expect(tag('aTextarea')).toBe('textarea');
        expect(form.controls.get('aCheckbox').control.type).toBe('checkbox');
        expect(form.controls.get('anInteger').control.type).toBe('number');
    });

    test("marks required fields accessibly, not by asterisk alone", () => {
        const c = container();
        renderForm(c, ALL_TYPES);
        const req = c.querySelector(".tagger-field-required");
        expect(req.getAttribute("aria-label")).toBe("required");
    });

    test("associates each label with its control", () => {
        const c = container();
        const form = renderForm(c, ALL_TYPES);
        for (const [key, { control }] of form.controls) {
            const label = c.querySelector(`label[for="${control.id}"]`);
            expect(`${key}: ${!!label}`).toBe(`${key}: true`);
        }
    });

    test("surfaces the descriptor hint as visible text, not only a tooltip", () => {
        const c = container();
        renderForm(c, FACT_VALUE_DERIVATION);
        const hints = [...c.querySelectorAll(".tagger-field-hint")].map(e => e.textContent);
        expect(hints.length).toBeGreaterThan(0);
        expect(hints.join(" ")).toMatch(/Power of 10/);
    });

    test("shows an unrenderable widget as a disabled row rather than dropping it", () => {
        // a generated descriptor asking for a widget this renderer lacks is a
        // gap to notice; silently skipping would hide exactly the drift the
        // descriptor pipeline exists to surface
        const c = container();
        renderForm(c, { scalar: [{ key: 'k', label: 'Repeating', type: 'propertyArray' }] });
        const row = c.querySelector(".tagger-field-unsupported");
        expect(row).not.toBeNull();
        expect(row.textContent).toMatch(/no widget for type "propertyArray"/);
    });

    test("seeds controls from values", () => {
        const c = container();
        const form = renderForm(c, ALL_TYPES,
            { values: { aText: 'hello', aCheckbox: true, aSelect: 'y', anInteger: 6 } });
        expect(form.controls.get('aText').control.value).toBe('hello');
        expect(form.controls.get('aCheckbox').control.checked).toBe(true);
        expect(form.controls.get('aSelect').control.value).toBe('y');
        expect(form.controls.get('anInteger').control.value).toBe('6');
    });

    test("re-rendering replaces rather than appends", () => {
        const c = container();
        renderForm(c, ALL_TYPES);
        renderForm(c, ALL_TYPES);
        expect(c.querySelectorAll(".tagger-field").length).toBe(8);
    });
});

describe("read", () => {
    test("omits unset fields, because absent and empty differ in the model", () => {
        const c = container();
        const form = renderForm(c, FACT_VALUE_DERIVATION);
        expect(form.read()).toEqual({});
    });

    test("omits an unchecked checkbox rather than writing false", () => {
        const c = container();
        const form = renderForm(c, ALL_TYPES);
        expect(form.read().aCheckbox).toBeUndefined();
        form.controls.get('aCheckbox').control.checked = true;
        expect(form.read().aCheckbox).toBe(true);
    });

    test("omits the empty select option the creator uses for unset", () => {
        const c = container();
        const form = renderForm(c, FACT_VALUE_DERIVATION);
        form.set('sign', '');
        expect(form.read().sign).toBeUndefined();
        form.set('sign', '-');
        expect(form.read().sign).toBe('-');
    });

    test("returns integers as numbers, so a scale is not journalled as a string", () => {
        const c = container();
        const form = renderForm(c, FACT_VALUE_DERIVATION);
        form.set('scale', '6');
        expect(form.read().scale).toBe(6);
    });

    test("keeps a non-numeric entry verbatim rather than coercing it to NaN", () => {
        const c = container();
        const form = renderForm(c, ALL_TYPES);
        form.controls.get('anInteger').control.value = 'abc';
        const v = form.read().anInteger;
        expect(Number.isNaN(v)).toBe(false);
    });
});

describe("onChange", () => {
    test("reports key, value and definition on edit", () => {
        const c = container();
        const seen = [];
        const form = renderForm(c, FACT_VALUE_DERIVATION,
            { onChange: (k, v, def) => seen.push([k, v, def.type]) });
        const scale = form.controls.get('scale').control;
        scale.value = '6';
        scale.dispatchEvent(new Event('input'));
        expect(seen).toContainEqual(['scale', 6, 'integer']);
    });
});

describe("the stand-in descriptor", () => {
    test("covers the derivation properties and none of the identity ones", () => {
        const keys = FACT_VALUE_DERIVATION.scalar.map(f => f.key);
        expect(keys).toEqual(
            expect.arrayContaining(['transformation', 'scale', 'sign', 'decimals', 'escape']));
        // editing these would make it a different fact, not correct a binding
        expect(keys).not.toContain('factDimensions');
        expect(keys).not.toContain('factQualifier');
    });

    test("uses only widget types the creator's vocabulary declares", () => {
        const allowed = new Set(['text', 'number', 'integer', 'checkbox', 'select',
                                 'qname', 'sqname', 'uri', 'textarea']);
        for (const f of FACT_VALUE_DERIVATION.scalar) {
            expect(`${f.key}: ${f.type}`).toBe(`${f.key}: ${allowed.has(f.type) ? f.type : 'UNKNOWN'}`);
        }
    });
});
