// require('source-map-support').install({ handleUncaughtExceptions: false })
import 'source-map-support/register'
import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/devops/devops'
import * as mri from 'mri'
import exithook = require('exit-hook')

process.nextTick(async () => {
	try {
		let argvs = mri(process.argv.slice(2))
		await (await import('@/emby/config')).config(process.DEVELOPMENT || argvs.scripts)
		if (process.DEVELOPMENT) await import('@/mocks/mocks')
		if (argvs.scripts) {
			return await import(`@/scripts/${argvs.scripts}`)
		}
		await import('@/emby/collections')
		await import('@/emby/favorites')
		await import('@/emby/search')
		await import('@/emby/strm')
		await import('@/emby/signup')
		await import('@/emby/refresh')
		await import('@/emby/subtitles')
		await import('@/emby/webhooks')
	} catch (error) {
		console.error(`process.nextTick -> %O`, error)
	}
	let timeout = setInterval(Function, 1 << 30)
	exithook(() => clearTimeout(timeout))
})
