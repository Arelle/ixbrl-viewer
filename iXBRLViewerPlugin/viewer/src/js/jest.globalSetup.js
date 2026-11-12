// See COPYRIGHT.md for copyright information

// Run tests away from UTC so that code relying on local time fails here as
// well as for users.  This has to happen before Jest starts its workers.
module.exports = () => {
    process.env.TZ = "America/New_York";
};
