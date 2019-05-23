import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/devops/logs'
import '@/devops/development'
import * as config from '@/emby/config'
import * as pDelay from 'delay'

async function start() {
	await config.setup()
	process.DEVELOPMENT && (await pDelay(1000)) // wait for 'Debugger attached'
	await import('@/mocks/mocks')
	await import('@/emby/collections')
	await import('@/emby/emby')
	await import('@/emby/favorites')
	await import('@/emby/search')
	await import('@/emby/strm')
	await import('@/scripts/users-sync')
}
process.nextTick(() => start().catch(error => console.error(`start -> %O`, error)))
