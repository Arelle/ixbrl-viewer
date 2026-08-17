// See COPYRIGHT.md for copyright information

/*
 * Form descriptors for the tagger, written in the OIM creator's OBJECT_SCHEMAS
 * shape.
 *
 * STAND-IN.  These are hand-written from the factValue node of
 * oim-taxonomy-schema.json.  They exist so the form renderer can be built and
 * shown before the schema-to-descriptor generator is agreed, and they are
 * deliberately shaped exactly like the creator's OBJECT_SCHEMAS entries --
 * `{scalar: [{key, label, type, required, options, hint}], arrays: [...]}`,
 * with the same widget vocabulary (text | number | integer | checkbox | select
 * | qname | sqname | uri | textarea).
 *
 * Adopting that shape rather than inventing one is the point.  It means a
 * generated descriptor is a drop-in replacement for this file with no change to
 * the renderer, and it means the renderer can be demonstrated against the
 * creator's own format rather than asking anyone to adopt a new one.
 *
 * Everything here should be deleted once the generator exists.  Until then, the
 * `hint` strings are paraphrases of the schema's `description` text, and the
 * `required` flags follow the schema's `required` arrays.
 */

/*
 * The value-derivation properties of a factValue: how the located source text
 * becomes the asserted value.
 *
 * Scoped to derivation on purpose.  The identity properties -- factDimensions,
 * factQualifier, period, entity -- answer "which fact is this", and editing
 * them makes a different fact rather than correcting a binding, so they are not
 * offered here.  See TAGGER.md 1.
 */
export const FACT_VALUE_DERIVATION = {
    scalar: [
        {
            key: 'transformation',
            label: 'Transformation',
            type: 'qname',
            hint: 'QName of a transformation applied to the extracted source text, '
                + 'e.g. xbrltt:num-comma-decimal for "41 182,5".',
        },
        {
            key: 'scale',
            label: 'Scale',
            type: 'integer',
            hint: 'Power of 10 the extracted numeric value is multiplied by, '
                + 'e.g. 6 where the document reports millions. Applied to every value source.',
        },
        {
            key: 'sign',
            label: 'Sign',
            type: 'select',
            options: ['', '-'],
            hint: 'Set to "-" where the extracted value must be negated to give the '
                + 'fact value, as for a figure shown in parentheses.',
        },
        {
            key: 'decimals',
            label: 'Decimals',
            type: 'text',
            hint: 'Decimal places to which the value is accurate, or INF where exact.',
        },
        {
            key: 'escape',
            label: 'Escape',
            type: 'checkbox',
            hint: 'True where the value is the escaped markup of the source rather than '
                + 'its concatenated text. Used for text blocks carrying HTML.',
        },
    ],
    arrays: [],
};

/*
 * Widget types the renderer understands, kept aligned with the creator's list
 * so a generated descriptor cannot ask for something unrenderable without it
 * being obvious.  Array widgets are not implemented here: the tagger's forms
 * are scalar-only so far, and rendering a half-working repeating editor would
 * be worse than declining the type.
 */
export const SUPPORTED_TYPES = new Set([
    'text', 'number', 'integer', 'checkbox', 'select', 'qname', 'sqname', 'uri', 'textarea',
]);

const byKey = key => FACT_VALUE_DERIVATION.scalar.find(f => f.key === key);

/*
 * The derivation fields a particular capture puts in play, as a descriptor
 * subset the renderer can take unchanged.
 *
 * The bind card shows only these rather than the whole descriptor.  Rendering
 * all five every time would bury the verdict under form furniture, and most of
 * them are irrelevant to any one capture.  Subsetting costs nothing because the
 * renderer takes whatever descriptor it is handed.
 *
 * Returning null is a real answer, and in two cases it is the important one:
 *
 *   unrelated  the two numbers have no scaling relationship, so the capture is
 *              on the wrong content.  Offering a scale box here would invite
 *              someone to adjust it until a bad bind looked acceptable, which
 *              is exactly what the unrelated verdict exists to prevent.
 *   coarse     the captured run contains the value plus more.  That is a
 *              capture problem, fixed by Widen or a narrower click, not by
 *              anything in the derivation chain.
 */
export function derivationFieldsFor(verdict, derivation) {
    if (verdict === 'agree' || verdict === 'coarse') {
        return null;
    }
    const kind = derivation?.kind;
    if (kind === 'solved') {
        const first = derivation.solutions[0] ?? {};
        const keys = [];
        if (first.scale != null) {
            keys.push('scale');
        }
        if (first.sign) {
            keys.push('sign');
        }
        if (!keys.length) {
            return null;
        }
        return {
            descriptor: { scalar: keys.map(byKey).filter(Boolean), arrays: [] },
            values: { scale: first.scale ?? undefined, sign: first.sign ?? undefined },
            // More than one derivation reproduces the value -- "01/02/2025" is
            // genuinely ambiguous -- so the alternatives are surfaced rather
            // than silently dropped in favour of the first.
            alternatives: derivation.solutions.slice(1),
        };
    }
    if (kind === 'shortlist') {
        const base = byKey('transformation');
        if (!base) {
            return null;
        }
        return {
            descriptor: {
                scalar: [{
                    ...base,
                    type: 'select',
                    options: ['', ...derivation.solutions.map(s => s.transformation)],
                    hint: base.hint + ' Candidates match the text by pattern; none has been '
                        + 'verified to reproduce the value.',
                }],
                arrays: [],
            },
            values: {},
            alternatives: [],
        };
    }
    return null;
}
