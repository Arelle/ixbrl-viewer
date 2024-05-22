// See COPYRIGHT.md for copyright information

const webpack = require('webpack');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');
const version = require("./version.js");

module.exports = merge(common, {
  mode: 'production',
  output: {
    filename: 'ixbrlviewer.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new webpack.DefinePlugin({ __VERSION__: JSON.stringify(version.prod_version())})
  ],
});
