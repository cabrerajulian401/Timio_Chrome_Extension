var webpack = require('webpack'),
  path = require('path'),
  fileSystem = require('fs-extra'),
  env = require('./utils/env'),
  CopyWebpackPlugin = require('copy-webpack-plugin'),
  HtmlWebpackPlugin = require('html-webpack-plugin'),
  TerserPlugin = require('terser-webpack-plugin');
var { CleanWebpackPlugin } = require('clean-webpack-plugin');

const ASSET_PATH = process.env.ASSET_PATH || '/';

var alias = {
  'react-dom': '@hot-loader/react-dom',
};

// load the secrets
var secretsPath = path.join(__dirname, 'secrets.' + env.NODE_ENV + '.js');

var fileExtensions = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'eot',
  'otf',
  'svg',
  'ttf',
  'woff',
  'woff2',
];

if (fileSystem.existsSync(secretsPath)) {
  alias['secrets'] = secretsPath;
}

var options = {
  mode: process.env.NODE_ENV || 'development',
  entry: {
    popup: path.join(__dirname, 'src', 'pages', 'Popup', 'index.jsx'),
    background: path.join(__dirname, 'src', 'pages', 'Background', 'index.js'),
    content: path.join(__dirname, 'src', 'pages', 'Content', 'index.js'),
    backgroundSimplified: path.join(__dirname, 'src', 'pages', 'Background', 'background.simplified.js'),
    // Updated: Sidepanel entry point now includes CSS
    sidepanel: path.join(__dirname, 'src', 'pages', 'sidepanel', 'sidepanel.js'),
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'build'),
    clean: true,
    publicPath: ASSET_PATH,
  },
  module: {
    rules: [
      {
        test: /\.(css|scss)$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' },
        ],
      },
      {
        // Handle image and asset files (excluding JSON)
        test: new RegExp('.(' + fileExtensions.join('|') + ')$'),
        type: 'asset/resource',
        exclude: /node_modules/,
        generator: {
            filename: 'assets/img/[name][ext]',
        }
      },
      {
        test: /\.html$/,
        loader: 'html-loader',
        exclude: /node_modules/,
      },
      { 
        test: /\.(ts|tsx)$/, 
        loader: 'ts-loader', 
        exclude: /node_modules/ 
      },
      {
        test: /\.(js|jsx)$/,
        use: [
          { loader: 'source-map-loader' },
          { loader: 'babel-loader' },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    alias: alias,
    extensions: fileExtensions
      .map((extension) => '.' + extension)
      .concat(['.js', '.jsx', '.ts', '.tsx', '.css']),
  },
  plugins: [
    new CleanWebpackPlugin({ verbose: false }),
    new webpack.ProgressPlugin(),
    new webpack.EnvironmentPlugin({
        NODE_ENV: process.env.NODE_ENV || 'development',
    }),
    new webpack.HotModuleReplacementPlugin(),

    new CopyWebpackPlugin({
      patterns: [
        // 1. Copy manifest.json with version injection
        {
          from: 'src/manifest.json',
          to: path.join(__dirname, 'build'),
          force: true,
          transform: function (content) {
            return Buffer.from(
              JSON.stringify({
                description: process.env.npm_package_description,
                version: process.env.npm_package_version,
                ...JSON.parse(content.toString()),
              })
            );
          },
        },

        // 2. Copy extension icons and images to build root (as referenced in manifest)
        { 
          from: 'src/assets/img/TIMIOCircle128.png', 
          to: path.join(__dirname, 'build', 'TIMIOCircle128.png'), 
          force: true 
        },
        { 
          from: 'src/assets/img/Torch_Icon.png', 
          to: path.join(__dirname, 'build', 'Torch_Icon.png'), 
          force: true 
        },
        { 
          from: 'src/assets/img/Pivot_Icon.png', 
          to: path.join(__dirname, 'build', 'Pivot_Icon.png'), 
          force: true 
        },
        { 
          from: 'src/assets/img/icon-128.png', 
          to: path.join(__dirname, 'build', 'icon-128.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/icon-34.png', 
          to: path.join(__dirname, 'build', 'icon-34.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/Union.png', 
          to: path.join(__dirname, 'build', 'Union.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/ARROW48.png', 
          to: path.join(__dirname, 'build', 'ARROW48.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/Vector.png', 
          to: path.join(__dirname, 'build', 'Vector.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/hand.png', 
          to: path.join(__dirname, 'build', 'hand.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/cup.png', 
          to: path.join(__dirname, 'build', 'cup.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/copyIcon.png', 
          to: path.join(__dirname, 'build', 'copyIcon.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/close.png', 
          to: path.join(__dirname, 'build', 'close.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/setting.png', 
          to: path.join(__dirname, 'build', 'setting.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/delete.png', 
          to: path.join(__dirname, 'build', 'delete.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/arrow.png', 
          to: path.join(__dirname, 'build', 'arrow.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/paste.png', 
          to: path.join(__dirname, 'build', 'paste.png'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: 'src/assets/img/loader.svg', 
          to: path.join(__dirname, 'build', 'loader.svg'), 
          force: true,
          noErrorOnMissing: true 
        },

        // 3. Copy Lottie animation JSON files to assets/animations/
        { 
          from: 'src/assets/animations/', 
          to: path.join(__dirname, 'build', 'assets', 'animations'), 
          force: true,
          noErrorOnMissing: true 
        },

        // 4. Copy required scripts and styles for content scripts
        { 
          from: path.join(__dirname, 'src', 'pages', 'sidepanel', 'Lottie.min.js'), 
          to: path.join(__dirname, 'build', 'lottie.min.js'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: path.join(__dirname, 'src', 'pages', 'sidepanel', 'Lottie_Manager.js'), 
          to: path.join(__dirname, 'build', 'lottie-manager.js'), 
          force: true,
          noErrorOnMissing: true 
        },
        { 
          from: path.join(__dirname, 'src', 'pages', 'Content', 'Readability.js'), 
          to: path.join(__dirname, 'build', 'Readability.js'), 
          force: true 
        },
        { 
          from: path.join(__dirname, 'src', 'pages', 'Content', 'content.styles.css'), 
          to: path.join(__dirname, 'build', 'content.styles.css'), 
          force: true 
        },

        // 5. REMOVED: sidepanel.css copy - now handled by webpack CSS loader
        // { 
        //   from: path.join(__dirname, 'src', 'pages', 'sidepanel', 'sidepanel.css'), 
        //   to: path.join(__dirname, 'build', 'sidepanel.css'), 
        //   force: true 
        // },
      ],
    }),

    // HTML plugins for popup and sidepanel
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'pages', 'Popup', 'index.html'),
      filename: 'popup.html',
      chunks: ['popup'],
      cache: false,
    }),
    
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src', 'pages', 'sidepanel', 'sidepanel.html'),
      filename: 'sidepanel.html',
      chunks: ['sidepanel'], // Include the sidepanel bundle (now includes CSS)
      cache: false,
      minify: false, // Don't minify to preserve manual script tags if any
    }),
  ],
  infrastructureLogging: {
    level: 'info',
  },
  watchOptions: {
    ignored: ['**/node_modules/**', '**/build/**'],
  },
};

// Development vs Production configuration
if (env.NODE_ENV === 'development') {
  options.devtool = 'cheap-module-source-map';
} else {
  options.optimization = {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          compress: {
            drop_console: false, // Keep console logs for debugging
          },
        },
      }),
    ],
  };
}

module.exports = options;