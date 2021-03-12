// Copyright 2019 Workiva Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import dateFormat from "dateformat"
import moment from "moment";

/* 
 * Takes a moment.js oject and converts it to a human readable date, or date
 * and time if the time component is not midnight.  Adjust specifies that a
 * date (but not a date time) should be shown as the day before.  This is to
 * satisfy the human convention of describing durations using inclusive dates.
 *
 * i.e. 2018-01-01T00:00:00 to 2019-01-01T00:00:00 is described as
 *      "Jan 1 2018 to Dec 31 2018"
 *
 */
export function momentToHuman(d, adjust) {
    if (d.hours() + d.minutes() + d.seconds() == 0) { 
        if (adjust) {
            d = d.clone().subtract(1, 'day');
        }
        return d.format('D MMM Y');
    }
    return d.format("D MMM Y HH:mm:ss");
}

/*
 * Format a number with a thousands separator, and the specified number of
 * decimal places.
 */
export function formatNumber(v, d) {
    var n = Number(v);
    var s = d === undefined ? n.toString() : n.toFixed(Math.max(0, d));
    return s.replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}

/* 
 * Takes a string phrase and breaks it into separate phrases no bigger than
 * 'maxwidth'. breaks are made at complete words.
 */
export function wrapLabel(str, maxwidth){
    var sections = [];
    var words = str.split(" ");
    var temp = "";

    words.forEach(function(item, index){
        if(temp.length > 0)
        {
            var concat = temp + ' ' + item;

            if(concat.length > maxwidth){
                sections.push(temp);
                temp = "";
            }
            else{
                if(index == (words.length-1))
                {
                    sections.push(concat);
                    return;
                }
                else{
                    temp = concat;
                    return;
                }
            }
        }

        if(index == (words.length-1))
        {
            sections.push(item);
            return;
        }

        if(item.length < maxwidth) {
            temp = item;
        }
        else {
            sections.push(item);
        }

    });
    return sections;
}

/*
 * Truncate the label to the specified length, breaking on a word boundary, and
 * adding an ellipsis if the label is actually shortened.
 */
export function truncateLabel(label, length) {
    var vv = wrapLabel(label, length);
    var t = vv[0];
    if (vv.length > 1) {
        t += ' \u2026';
    }
    return t;
}

/* 
 * The JSON format supports datetimes being abbreviated to just xsd:dates.
 * moment.js doesn't support timezoned dates, so fix them to midnight before
 * passing to moment 
 *
 * Note that the strings we're working with are not raw XBRL 2.1 dates, and
 * do not apply different conventions for start and aned dates.  A date
 * with no time part always means T00:00:00.
 */
export function xbrlDateToMoment(dateString) {
    /* If the string has something after the date part other than a time part,
     * insert a time part of 'T00:00:00'
     *
     * i.e. 2010-01-01Z => 2010-01-01T00:00:00Z
     */
    dateString = dateString.replace(
        /^(\d{4,}-\d{2}-\d{2})(?!T|$)/, 
        function(match, $1) { return $1 + 'T00:00:00' }
    );
    return moment.utc(dateString);
}

export function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export function setDefault(obj, key, def) {
    if (!obj.hasOwnProperty(key)) {
        obj[key] = def;
    }
    return obj[key];
}
