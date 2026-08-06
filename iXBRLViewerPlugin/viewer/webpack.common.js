// See COPYRIGHT.md for copyright information

const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: './src/js/index.js',
  context: path.resolve(__dirname),
  module: {
    rules: [
                {
                    test: /\.svg$/,
                    resourceQuery: /raw/,
                    type: "asset/source"
                },
                {
                    test: /\.(woff(2)?|ttf|eot|svg|png|ico)(\?v=\d+\.\d+\.\d+)?$/,
                    resourceQuery: { not: [/raw/] },
                    use: "base64-inline-loader"
                },
                {
                    test: /\.html$/,
                    use: [ { 
                        loader: "html-loader",
                        options: {
                            esModule: false,
                            minimize: {
                                removeAttributeQuotes: false,
                                keepClosingSlash: true
                            }
                        }
                    }]
                },
                {
                    test: /\.less$/,
                    use: [
                        {
                            loader: "css-loader",
                            options: {
                                esModule: false
                            }
                        },
                        {
                            loader: "less-loader",
                            options: {
                                lessOptions: {
                                    math: "parens-division"
                                }
                            }
                        }
                    ]
                }
            ]


  },
  plugins: [
    // Ignore all locale files of moment.js
    new webpack.IgnorePlugin({ resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/ }),
  ]
};
