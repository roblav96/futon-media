const path = require('path')

const basepath = path.dirname(__filename)
const basename = path.basename(__dirname)

module.exports = {
	applications: [
		{
			'base-path': basepath,
			'cwd': basepath,
			'instances': 1,
			'logger-args': [`${basename}.log`],
			'mode': 'fork',
			'name': basename,
			'node-args': ['--no-warnings', '--max-old-space-size=8192'],
			'ready-on': 'instant',
			'restart-crashing-delay': 3000,
			'run': path.join(basepath, 'dist/index.js'),
			'type': 'application',
		},
	],
}
