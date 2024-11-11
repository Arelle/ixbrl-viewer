// See COPYRIGHT.md for copyright information

import $ from 'jquery'
import { Viewer } from './viewer.js';

jest.mock('./number-matcher.js');
const nms = require('./number-matcher.js');

describe("Find untagged numbers pre-process", () => {

    var viewer = new Viewer(null, $(this), null);
    test("Check search text", () => {

        // For each test the expected output is the blocks of text that should
        // be searched for untagged dates and numbers
        const tests = [
            { 
                // If it's got a format we assume that it's not a text block
                // and so don't look for numbers or dates in it
                "input": '<ix:nonNumeric format="ixt:foo">This is considered tagged 2001</ix:nonNumeric>',
                "search": [ ]
            },
            {
                // It's not got a format, we search it, but in "ignoreFullMatch" mode
                "input": "<ix:nonNumeric>2001-01-01</ix:nonNumeric>",
                "search": [ "2001-01-01" ]
            },
            {
                // It's not got a format, we search it, but in "ignoreFullMatch" mode
                "input": "<ix:nonNumeric>April 30, 2022</ix:nonNumeric>",
                "search": [ "April 30, 2022" ]
            },
            {
                // It's not got a format, we search it, but in "ignoreFullMatch" mode
                "input": "<ix:nonNumeric>April 30</ix:nonNumeric>",
                "search": [ 'April 30' ]
            },
            {
                // It's not got a format, we search it, but in "ignoreFullMatch" mode
                "input": "<ix:nonNumeric>on April 30, 2022</ix:nonNumeric>",
                "search": [ 'on April 30, 2022' ]
            },
            {
                // It's not got a format, we search it, but in "ignoreFullMatch" mode
                "input": "<ix:nonNumeric> April 30, 2022 </ix:nonNumeric>",
                "search": [ " April 30, 2022 " ]
            },
            { 
                "input": '<ix:nonNumeric>This is 4 5 6 not considered tagged 2001</ix:nonNumeric>',
                "search": [ "This is 4 5 6 not considered tagged 2001" ]
            },
            { 
                "input": "<ix:nonNumeric>2001 -01- 01</ix:nonNumeric>",
                "search": [ "2001 -01- 01" ]
            },
            { 
                "input": "<ix:nonNumeric>2001 <div>-01-</div> 01</ix:nonNumeric>",
                "search": [ "2001 ", "-01-", " 01" ]
            },
            { 
                // The content of the outer non-numeric looks like a tagged
                // date, but we search it anyway in "ignore full match" mode
                "input": "<ix:nonNumeric>2001-<ix:nonFraction>01</ix:nonFraction>-01</ix:nonNumeric>",
                "search": [ "2001-", "-01" ] 
            },
            { 
                "input": "<ix:nonNumeric>2001- <ix:nonFraction>01</ix:nonFraction> -01</ix:nonNumeric>",
                "search": [ "2001- ", " -01" ] 
            },
            { 
                // -sec-ix-hidden facts are considered tagged
                "input": '1 <span style="-sec-ix-hidden: abcd">2</span> 3',
                "search": [ "1 ", " 3" ] 
            },
            { 
                // -sec-ix-hidden facts are considered tagged
                "input": '<ix:nonNumberic>2010-01-01 <span style="-sec-ix-hidden: abcd">2010-01-01</span> 2010-01-01</ix:nonNumberic',
                "search": [ "2010-01-01 ", " 2010-01-01" ] 
            },
        ]

        for (const t of tests) {
            nms.numberMatchSearch = jest.fn();
            var html = $("<div>" + t.input + "</div>");
            viewer._wrapUntaggedNumbers(html);
            // Create an array of the first argument to each call to
            // numberMatchSearch
            var matches = $.map(nms.numberMatchSearch.mock.calls, (e) => e[0]);
            expect(matches).toEqual(t.search)
        }
    });
});
