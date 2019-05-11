const path = require('path')

const basepath = path.dirname(__filename)
const basename = path.basename(__dirname)

module.exports = {
	apps: [
		{
			automation: false,
			cwd: basepath,
			// error: '/dev/null',
			// error_file: './wtf-error.log',
			// log: './futon-media.log',
			// log: `${process.env.HOME}/.pm2/logs/futon-media.log`,
			name: basename,
			// out_file: './wtf-out.log',
			// output: '/dev/null',
			pmx: false,
			script: path.join(basepath, 'dist/index.js'),
			vizion: false,

			output: path.join(basepath, 'log/out.log'),
			error: path.join(basepath, 'log/error.log'),
			log: path.join(basepath, 'log/combined.log'),
		},
	],
}
