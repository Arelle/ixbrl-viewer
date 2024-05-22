// See COPYRIGHT.md for copyright information
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
