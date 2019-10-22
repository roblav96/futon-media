import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/devops/devops'

async function start() {
	if (process.DEVELOPMENT) await import('@/mocks/mocks')
	await (await import('@/emby/config')).config()
	if (process.args.scripts) {
		return await import(`@/scripts/${process.args.scripts}`)
	}
	await import('@/emby/collections')
	await import('@/emby/favorites')
	await import('@/emby/search')
	await import('@/emby/strm')
	await import('@/emby/webhooks')
}
process.nextTick(() => start().catch(error => console.error(`start -> %O`, error)))

setInterval(Function, 1 << 30)
