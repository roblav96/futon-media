setInterval(Function, 1 << 30)
import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/devops/devops'

process.nextTick(async () => {
	try {
		if (process.DEVELOPMENT) await import('@/mocks/mocks')
		if (process.args.scripts) {
			return await import(`@/scripts/${process.args.scripts}`)
		}
		await (await import('@/emby/config')).config()
		await import('@/emby/collections')
		await import('@/emby/favorites')
		await import('@/emby/search')
		await import('@/emby/strm')
		await import('@/emby/signup')
		await import('@/emby/refresh')
		await import('@/emby/subtitles')
		await import('@/emby/webhooks')
	} catch (error) {
		console.error(`index -> %O`, error)
	}
})
