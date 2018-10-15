const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'ixbrlviewer.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
                {
                    test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
                    use: "base64-inline-loader"
                }
            ]


  }



/*
  node: {
            fs: 'empty'
  },
*/
/*
  externals: [
    {
       './cptable': 'var cptable',
       '../xlsx.js': 'var _XLSX'
    }
  ]
*/
};
