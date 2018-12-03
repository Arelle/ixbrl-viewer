
module.exports = {
  entry: './src/index.js',
  module: {
    rules: [
                {
                    test: /\.(woff(2)?|ttf|eot|svg|png)(\?v=\d+\.\d+\.\d+)?$/,
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
