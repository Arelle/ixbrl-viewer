// See COPYRIGHT.md for copyright information

const webpack = require('webpack');
const path = require('path');

module.exports = {
  entry: './src/js/index.js',
  context: path.resolve(__dirname),
  module: {
    rules: [
                {
                    test: /\.(woff(2)?|ttf|eot|svg|png|ico)(\?v=\d+\.\d+\.\d+)?$/,
                    use: "base64-inline-loader"
                },
                {
                    test: /\.html$/,
                    use: [ { 
                        loader: "html-loader",
                        options: {
                            minimize: true,
                            removeAttributeQuotes: false,
                            keepClosingSlash: true
                        }
                    }]
                },
                {
                    test: /\.less$/,
                    use: [ { 
                        loader: "less-loader",
                        options: {
                            lessOptions: {
                                math: "parens-division"
                            }
                        }
                    }]
                }
            ]


  },
  plugins: [
    // Ignore all locale files of moment.js
    new webpack.IgnorePlugin({ resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/ }),
  ]
};
