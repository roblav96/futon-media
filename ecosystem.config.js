module.exports = {
	apps: [
		{
			name: 'futon-media',
			cwd: `${process.env.HOME}/projects/futon-media`,
			script: 'dist/index.js',
			log: `${process.env.HOME}/.pm2/logs/futon-media.log`,
		},
	],
}
