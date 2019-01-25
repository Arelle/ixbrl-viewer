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

import { isodateToHuman, formatNumber, wrapLabel, escapeRegex } from "./util.js"

/* isoDateToHuman */
test("Simple date with no time", () => {
  expect(isodateToHuman(new Date(2018,0,1))).toBe("1 Jan 2018")
});

test("Simple date with time", () => {
  expect(isodateToHuman(new Date(2018,0,1,7,8))).toBe("1 Jan 2018 07:08:00")
});

test("Adjusted date should give previous day", () => {
  expect(isodateToHuman(new Date(2018,0,1),true)).toBe("31 Dec 2017")
});

test("Adjust does not have any effect if there's a time componetn", () => {
  expect(isodateToHuman(new Date(2018,0,1,9,8,7),true)).toBe("1 Jan 2018 09:08:07")
});

/* formatNumber */
test("Format number, no decimals", () => {
  expect(formatNumber(37123456,0)).toBe("37,123,456")
});

test("Format number, with rounding", () => {
  expect(formatNumber(37123456.78,0)).toBe("37,123,457")
});

test("Format number, add some decimals", () => {
  expect(formatNumber(123456,2)).toBe("123,456.00")
});

test("Format negative number number, add some decimals", () => {
  expect(formatNumber(-123456,3)).toBe("-123,456.000")
});

/* wrapLabel */
test("wrap label at width 10", () => {
  expect(wrapLabel("The cat sat on the mat.  My hovercraft is full of eels.", 10)).toEqual([
    "The cat",
    "sat on the",
    "mat.  My",
    "hovercraft",
    "is full of",
    "eels."
  ])
});
test("Words that exceed line length", () => {
  expect(wrapLabel("A verylongword is ok.", 10)).toEqual([
    "A",
    "verylongword",
    "is ok."
  ])
});

test("Leading and trailing space", () => {
  expect(wrapLabel(" leading and trailing space ", 10)).toEqual([
    "leading",
    "and",
    "trailing",
    "space "
  ])
});

/* escapeRegex */
test("Regex escape", () => {
  expect(escapeRegex("a.b*{}")).toBe("a\\.b\\*\\{\\}")
});

