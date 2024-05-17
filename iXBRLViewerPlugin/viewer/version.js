// See COPYRIGHT.md for copyright information

const exec = require('child_process');

function git_describe() {
    if (process.env.GIT_TAG !== undefined) {
        return process.env.GIT_TAG;
    }
    return exec.execSync("git describe --tags --dirty", {encoding: "utf-8"}).trim();
}

module.exports = {
    dev_version: function() {
        return git_describe() + "-dev";
    },
    prod_version: function() {
        return git_describe();
    }
};
