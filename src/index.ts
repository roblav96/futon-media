import 'node-env-dev'
import 'module-alias/register'
import 'dotenv/config'
import '@/devops/devops'
import * as mri from 'mri'
import exitHook = require('exit-hook')

process.nextTick(async () => {
	let argvs = mri(process.argv.slice(2))
	await (await import('@/emby/config')).config(process.env.NODE_ENV == 'development' || argvs.scripts)
	if (process.env.NODE_ENV == 'development') await import('@/mocks/mocks')
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
	// await import('@/debrids/relay')
	let timeout = setInterval(Function, 1 << 30)
	exitHook(() => clearTimeout(timeout))
	exitHook(() => console.warn(`exitHook`))
})
