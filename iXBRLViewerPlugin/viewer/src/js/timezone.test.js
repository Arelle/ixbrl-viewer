// See COPYRIGHT.md for copyright information

// The date tests only guard against local time bugs if jest.globalSetup.js
// really moved them off UTC.
test("Tests run in New York time", () => {
    expect(new Date("2018-01-01T00:00:00Z").getTimezoneOffset()).toBe(300);
});
