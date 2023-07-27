// See COPYRIGHT.md for copyright information

function r_or(terms) {
    return '(?:' + terms.join('|') + ')';
}

function r_maybe(expr) {
    return '(?:' + expr + ')?';
}

function r_zero_or_more(expr) {
    return '(?:' + expr + ')*';
}

const percent_symbol = '\\%';
const DOLLAR_SYMBOL = '$';          // generic dollar sign
const CENT_SYMBOL = '\u00A2';       // generic cent sign
const USD_SYMBOL = '\\bUS$';        // United states dollar
const EUR_SYMBOL = '\u20AC';        // European union euro
const GBP_SYMBOL = '\u00A3';        // British pound
const JPY_SYMBOL = '\u00A5';        // Japanese yen
const CAD_SYMBOL = '\\bC$';         // Canadian dollar
const AUD_SYMBOL = '\\bA$';         // Australian dollar
const TWD_SYMBOL = '\\bNT$';        // Taiwanese dollar
const SGD_SYMBOL = '\\bS$';         // Singaporean dollar
const KRW_SYMBOL = '\u20A9';        // Korean won
const PHP_SYMBOL = '\u20B1';        // Philippine peso
const INR_SYMBOL = '\u20A8';        // Indian rupee
const SEK_SYMBOL = '\\bkr';         // Swedish kronor
const CHF_SYMBOL = '\\bFr.';        // Swiss franc
const MYR_SYMBOL = '\\bRM';         // Malaysian ringgit
const BRL_SYMBOL = '\\bR$';         // Brazilian real
const ZAR_SYMBOL = '\\bR';          // South African Rand

const currencies = [DOLLAR_SYMBOL, CENT_SYMBOL, USD_SYMBOL, EUR_SYMBOL, GBP_SYMBOL, JPY_SYMBOL, CAD_SYMBOL,
              AUD_SYMBOL, TWD_SYMBOL, SGD_SYMBOL, KRW_SYMBOL, PHP_SYMBOL, INR_SYMBOL, SEK_SYMBOL,
              CHF_SYMBOL, MYR_SYMBOL, BRL_SYMBOL, ZAR_SYMBOL];

const currency_symbol = r_or(currencies)
    .replace(/([$.])/g, '\\$1'); // escape regex chars ('$' and '.')

// space, non-breaking space, tab
const one_ws = "[ \u00A0\t\n\r]";
const ws = one_ws + '*';

const hyphen = '[-\u2014]';

// everything that we allow immediately before a match 
// (201c = left double quote, 2014 = em dash, 201d = right double quote)
const begin_guard = '(?:^|(?<=(?:[/\u201c\u2014(]|' + one_ws + '|' + hyphen + ')))';
// everything that we allow immediately after a match
const end_guard = '(?:$|(?=(?:[/,.:;\u201d\u2014)]|' + one_ws + '|' + hyphen + ')))';

const ordinal_suffix = '(?:st|nd|rd|th)';
const day = '[123]?\\d' + ordinal_suffix + '?';

const month = '(?:jan|january|feb|february|mar|march|apr|april|may|jun|june' + 
              '|jul|july|aug|august|sep|september|sept|oct|october' + 
              '|nov|november|dec|december)';

const month_num = '(?:[01]?\\d)';
const year = '(?:19|20)\\d\\d';
const a_year = 'year' + ws + year;

const date1 = month + ws + day + ws + ',' + ws + year ;
const date2 = year + ws + month + ws + day;
const date3 = month + ws + year;
const date4 = month + ws + day;
const isoDate = '\\d{4}-\\d{2}-\\d{2}';
const date = r_or([date1, date2, date3, date4, isoDate]);
export const fullDateMatch = '\\b' + r_or([date1, date2, isoDate]) + '\\b';
export const dateMatch = '\\b' + r_or([date, year, a_year]) + '\\b';

const month_word = 'months?';
const month_suffixed = '\\d+' + ws + month_word;

const number_word = '(?:\\b(?:zero|one|two|three|four(?:teen)?|five|six(?:ty|teen)?|seven(?:ty|teen)?|eight(?:y|een)?|nine(?:ty|teen)?' +
              '|ten|eleven|twelve|thirteen|fifteen|' +
              'twenty|thirty|forty|fifty)\\b)';

const number_word_multiplier = '(\\b(hundred|thousand|million|billion|trillion)\\b)';

const section = 'section' + ws + '\\d{1,3}\\(?:?\\w\\)?';
const topic = 'topic' + ws + '\\d{1,3}(?:\\.[\\w\\d])*';
const form = 'form' + ws + '\\d{1,2}-\\w';
const asc = 'asc' + ws + '\\w\\d{1,3}(?:-\\w?\\d{1,3})*';
const item = 'item' + ws + '\\d{1,2}\\w?';
const rule = 'rule' + ws + '\\d{1,3}\\w?(?:-\\d{1,3}\\w?)*';
const note = 'note' + ws + '\\d{1,3}';
const level = 'level' + ws + '\\d{1,3}';
const page = 'page' + ws + '\\d{1,3}';
const tier = 'tier' + ws + '\\d{1,3}';

const months_ended = r_or([number_word, '\\d+']) + ws + 'months ended';

const day_with_0 = '[0-3]?\d';
const month_day_year = month_num + '/' + day_with_0 + '/' + year;
const month_year = month_num + '/\\d\\d';

const do_not_want = r_or([section, topic, form, asc, item, rule, note, level, page,
                    tier, months_ended, month_day_year, month_year]);

const number_separator = r_or([r_maybe(ws + hyphen + ws), ws]);
const number_word_string = number_word + r_zero_or_more(number_separator + number_word);
const number_word_string_with_multipliers = number_word_string +
    r_zero_or_more(
        number_separator + number_word_multiplier + 
        r_maybe(number_separator + number_word_string)
    )

const none_words = '\\b(?:no|none)\\b';

// hyphen minus, armenian hyphen, hebrew punctuation maqaf, hyphen
// non-breaking hyphen, figure dash, en dash, em dash, horizontal bar
// small em dash, small hyphen minu
const dashes = '[\u002d\u058a\u05be\u2010-\u2015\ufe58\ufe63]';


const number_matcher = r_or([
        r_or(['\\d{1,3}(?:,\\d{3})+', '\\d+']) + r_maybe('\\.\\d+'),
        '\\.\\d+'
    ]);

const formatted_number = r_or([
    r_maybe(currency_symbol + ws) + r_maybe('[-+(]' + ws)
    + r_maybe(currency_symbol + ws)
    + number_matcher
    + r_maybe(ordinal_suffix)
    + r_maybe(ws + r_or([currency_symbol, percent_symbol]))
    + ws + '\\)?'
    + r_maybe(ws + r_or([currency_symbol, percent_symbol])),
    number_word_string_with_multipliers,
    none_words,
    dashes
]);

/* Group 1 = date */
/* Group 2 = do_not_want */
export const numberMatch = begin_guard + r_or(['(' + dateMatch + ')', '(' + do_not_want + ')', month_suffixed, formatted_number ]) + end_guard;
const numberMatchRegex = new RegExp(numberMatch, 'gi');

/* Search for numbers/dates in s, calling f on each match:
 *
 * f(match, do_not_want, is_date) 
 *
 * match       - the return from Regex.exec 
 * do_not_want - true if the match is for something which should not be
 *               considered a number or date
 * is_date     - true if the match is a date 
 */
export function numberMatchSearch(s, f) {
    var m;
    while ((m = numberMatchRegex.exec(s)) !== null) {
        var do_not_want = m[2] !== undefined;
        var is_date = m[1] !== undefined;
        f(m, do_not_want, is_date);
    }
}
