setInterval(Function, 1 << 30) // prevent process from exiting

import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/devops/devops'

async function start() {
	await (await import('@/emby/config')).setup()
	await import('@/emby/collections')
	await import('@/emby/favorites')
	await import('@/emby/proxy')
	await import('@/emby/search')
	await import('@/emby/strm')
}
process.nextTick(() => start().catch(error => console.error(`start -> %O`, error)))
