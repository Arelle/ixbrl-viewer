const webpack = require("webpack");
const path = require("path");

module.exports = {
  entry: "./src/index.js",
  mode: "development",
  devtool: "inline-source-map",
  watch: false,
  output: {
    filename: "d6v.js",
    path: path.resolve(__dirname, "dist")
  },
  module: {
    rules: [
      {
        test: /\.(woff(2)?|ttf|eot|svg|png|ico)(\?v=\d+\.\d+\.\d+)?$/,
        use: "base64-inline-loader"
      },
      {
        test: /\.html$/,
        use: [
          {
            loader: "html-loader",
            options: {
              minimize: true,
              esModule: false
            }
          }
        ]
      },
      {
        test: /\.less$/,
        use: [
          {
            loader: "less-loader",
            options: {
              lessOptions: {
                math: "parens-division"
              }
            }
          }
        ],
        type: "asset/source"
      }
    ]
  },
  plugins: [new webpack.IgnorePlugin({ resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/ })]
};
