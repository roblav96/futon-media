module.exports = {
	applications: [
		{
			'name': 'futon-media',
			'cwd': `${process.env.HOME}/live/futon-media`,
			'run': 'dist/index.js',
			'ready-on': 'instant',
			'restart-crashing-delay': 3000,
		},
	],
}
