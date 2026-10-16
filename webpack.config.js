const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/web/main.tsx',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.web.json',
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      crypto: false,
      fs: false,
      path: false,
      module: false,
    },
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist-web'),
    publicPath: 'auto',
    clean: true,
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/^node:module$/, 'module'),
    new HtmlWebpackPlugin({
      template: './src/web/index.html',
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: path.join(path.dirname(require.resolve('highs')), 'highs.wasm'), to: 'highs.wasm' },
        {
          from: 'data',
          to: '.',
          globOptions: {
            ignore: ['**/.DS_Store'],
          },
        },
      ],
    }),
  ],
  mode: 'production',
  cache: false,
  devtool: 'source-map',
};

