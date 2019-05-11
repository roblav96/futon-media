module.exports = {
	applications: [
		{
			'type': 'application',
			'name': 'futon-media',
			'cwd': './',
			// 'cwd': `${process.env.HOME}/live/futon-media`,
			// 'base-path': `${process.env.HOME}/live/futon-media`,
			'run': './dist/index.js',
			'env': process.env,
			'ready-on': 'instant',
			'restart-crashing-delay': 3000,
			'instances': 1,
			'mode': 'fork',
		},
	],
}
