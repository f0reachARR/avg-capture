const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTestPlugin = require('extract-text-webpack-plugin');

let conf = {
    entry: ['babel-polyfill', './src/main.tsx'],
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'bin')
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [{
                    loader: 'awesome-typescript-loader',
                    options: {
                        useBabel: true,
                        'babelOptions': {
                            'babelrc': false,
                            'presets': [
                                ['es2015']
                            ]
                        }
                    }
                }]
            },
            {
                test: /\.css$/,
                use: ExtractTestPlugin.extract({
                    fallback: 'style-loader',
                    use: [
                        'css-loader'
                    ]
                })
            },
            {
                test: /\.(ttf|otf|woff2?|eot|svg)$/,
                use: ['file-loader']
            }
        ]
    },
    plugins: [
        new ExtractTestPlugin('bundle.css'),
        new webpack.NamedModulesPlugin(),
        new webpack.NoEmitOnErrorsPlugin(),
        new HtmlWebpackPlugin({
            template: './assets/template.html',
            inject: 'body'
        })
    ],
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx']
    },
    target: 'electron-renderer'
};

if (process.env.NODE_ENV === 'production') {
    conf.output.path = path.resolve(__dirname, 'prod');
    conf.plugins.unshift(
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify(process.env.NODE_ENV),
            },
        }));
    conf.plugins.push(
        new webpack.optimize.OccurrenceOrderPlugin(),
        new webpack.optimize.UglifyJsPlugin(),
    );
    let conf2 = [
        Object.assign({}, conf),
        Object.assign({}, conf, {
            plugins: [
                new webpack.optimize.OccurrenceOrderPlugin(),
                new webpack.optimize.UglifyJsPlugin(),
                new webpack.NamedModulesPlugin(),
                new webpack.NoEmitOnErrorsPlugin(),
                new webpack.DefinePlugin({
                    'process.env': {
                        NODE_ENV: JSON.stringify(process.env.NODE_ENV),
                    },
                    __dirname: '__dirname'
                })
            ],
            entry: './src/app.ts',
            target: 'electron-main',
            output: Object.assign({}, conf.output, { filename: 'app.js' })
        })
    ];
    conf = conf2;
} else {
    conf.devtool = 'source-map';
}
module.exports = conf;