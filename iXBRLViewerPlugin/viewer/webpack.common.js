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
