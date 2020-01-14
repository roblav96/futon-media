setInterval(Function, 1 << 30)
import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/devops/devops'

process.nextTick(async () => {
	try {
		await (await import('@/emby/config')).config()
		if (process.DEVELOPMENT) await import('@/mocks/mocks')
		if (process.args.scripts) {
			return await import(`@/scripts/${process.args.scripts}`)
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
})
