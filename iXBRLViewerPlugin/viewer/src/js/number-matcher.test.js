// See COPYRIGHT.md for copyright information

import { numberMatch, numberMatchRegex, numberMatchSearch, dateMatch } from './number-matcher.js';

describe("Number matcher", () => {
    var date_re = new RegExp('^' + dateMatch + '$', 'i');
    test("Valid dates", () => {
        var dates = [
           'Sept 20th, 2019',
           'Sept 20, 2019',
           'January 21st , 1999',
           'November 30, 1999',
           '2019 September 13th',
           'Feb 2020',
           'Feb 21',
           'Feb 21st',
           '2019',
           '1999',
           '2020-01-01'
        ];
        dates.forEach((d) => {
            var m = d.match(date_re);
            expect(m).not.toBeNull();
            expect(m[0]).toEqual(d);
        });
    });

    test("Invalid dates", () => {
        var dates = [
            '40th Sept 2019',
            '20th Sept 20190',
            'Feb 50',
            '20190',
            '1898'
        ];
        dates.forEach((d) => {
            expect(d.match(date_re)).toBeNull();
        });
    });


    var nmre = new RegExp('^' + numberMatch + '$', 'i');
    test("Valid numbers", () => {
        var numbers = [
            '1,000,000.00',
            '$1,000,000.00',
            '.01',
            '$.01',
            '$(1.00)',
            '($1.00)',
            '(€1.00)',
            'RM100',
            '-100',
            '-1000',
            '+1,000',
            '1,000th',
            'Fr. 100',
            '100$',
            '3 months',
            '€123',
            'C$123',
            'NT$123',
            '-',
            '—',
            '–'
        ];
        numbers.forEach((d) => {
            var m = d.match(nmre);
            expect(m).not.toBeNull();
            expect(m[0]).toEqual(d);
        });
    });

    test("Invalid numbers", () => {
        var numbers = [
            '1.0.1',
            '10,00',
            '10,00',
            'XRM100',
            'non',
            'nonenone',
            'a-',
            '-b',
            '1-',
        ];
        numbers.forEach((d) => {
            var m = d.match(nmre);
            expect(m).toBeNull();
        });
    });

    test("Valid numbers as words", () => {
        var numbers = [
            'one hundred',
            'two thousand',
            'four trillion',
            'twenty-five',
            'no',
            'None',
            'none'
        ];
        numbers.forEach((d) => {
            var m = d.match(nmre);
            expect(m).not.toBeNull();
            expect(m[0]).toEqual(d);
        });
    });
});

describe("Number match replace", () => {
    test("Number replacements", () => {
        var numbers = [
            [ 'Sept 20th, 2019', '[[Sept 20th, 2019]]' ],
            [ 'abcd 37 abcd', 'abcd [[37]] abcd' ],
            // Test "do not want" filtering
            [ 'abcd topic 37 abcd', 'abcd topic 37 abcd' ],
            [ 'abcd topic 37 93 abcd', 'abcd topic 37 [[93]] abcd' ],
            [ 'section 123(a)', 'section 123(a)' ],
            [ 'section 123a', 'section 123a' ],
            [ 'section 123', 'section 123' ],
            // Doesn't match due to end guard
            [ '401(k)', '401(k)' ],
            [ 'N RM100', 'N [[RM100]]' ],
            [ 'NRM100', 'NRM100' ],
            [ 'a - b', 'a [[-]] b' ],
            [ 'a-b', 'a-b' ],
            [ '-', '[[-]]' ],
            [ 'An ISO 2020-01-01 date', 'An ISO [[2020-01-01]] date' ],
            [ "2020-01-01\n", "[[2020-01-01]]\n" ]
        ];
        numbers.forEach((d) => {
            var out = '';
            var pos = 0;
            numberMatchSearch(d[0], function (m, dnw, date) { 
                out += d[0].substring(pos, m.index);
                if (dnw) {
                    out += m[0];
                }
                else {
                    out += '[[' + m[0] + ']]';
                }
                pos = m.index + m[0].length;
            })
            out += d[0].substring(pos, d[0].length);
            expect(out).toEqual(d[1]);
        });
    });

});
