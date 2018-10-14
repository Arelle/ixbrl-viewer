const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'ixbrlviewer.js',
    path: path.resolve(__dirname, 'dist')
  },
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
