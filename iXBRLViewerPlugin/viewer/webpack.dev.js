// See COPYRIGHT.md for copyright information

const webpack = require('webpack');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const path = require('path');
const version = require("./version.js");

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  watch: false,
  output: {
    filename: 'ixbrlviewer.dev.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new webpack.DefinePlugin({ __VERSION__: JSON.stringify(version.dev_version())})
  ],
});
