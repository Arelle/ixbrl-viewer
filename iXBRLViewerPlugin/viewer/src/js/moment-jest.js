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
//
import diff from 'jest-diff';
import moment from 'moment';

/* Helper to allow us to use toEqualDate() in jest tests */
expect.extend({
    toEqualDate(unparsedReceived, unparsedExpected) {
        const received = moment(unparsedReceived);
        const expected = moment(unparsedExpected);

        const receivedAsString = received.format();
        const expectedAsString = expected.format();

        const pass = received.isSame(expected);

        const message = pass
            ? () =>
                    `${this.utils.matcherHint('.not.toBe')}\n\n` +
                    'Expected date to not be same date as:\n' +
                    `    ${this.utils.printExpected(expectedAsString)}\n` +
                    'Received:\n' +
                    `    ${this.utils.printReceived(receivedAsString)}`
            : () => {
                const diffString = diff(expectedAsString, receivedAsString, {
                    expand: this.expand,
                });
                return `${this.utils.matcherHint('.toBe')}\n\n` +
                        'Expected value to be (using ===):\n' +
                        `    ${this.utils.printExpected(expectedAsString)}\n` +
                        'Received:\n' +
                        `    ${this.utils.printReceived(receivedAsString)}${diffString ? `\n\nDifference:\n\n${diffString}` : ''}`;
            };
        return { actual: received, message, pass };
    },
});
