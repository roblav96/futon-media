const app = {
	name: 'futon-media',

	cwd: `${process.env.HOME}/live/futon-media`,
	script: 'dist/index.js',

	output: '/dev/null',
	error: '/dev/null',
	log: `${process.env.HOME}/.pm2/logs/futon-media.log`,

	automation: false,
	pmx: false,
	vizion: false,
}

module.exports = { apps: [app] }
