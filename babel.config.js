module.exports = {
	presets: [
		[
			'@babel/preset-env',
			{
				targets: { node: 'current' },
			},
		],
		['@babel/preset-typescript'],
	],
	plugins: [
		['@babel/plugin-transform-runtime'],
		['@babel/plugin-syntax-dynamic-import'],
		// ['@babel/plugin-syntax-decorators', { decoratorsBeforeExport: true }],
		['@babel/plugin-proposal-decorators', { decoratorsBeforeExport: true }],
		['@babel/plugin-proposal-class-properties'],
		// ['@babel/proposal-object-rest-spread'],
	],
}
