import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/devops/logs'
import '@/devops/development'
import * as config from '@/emby/config'

async function start() {
	await config.setup()
	// use dynamic imports to avoid circular null references
	await import('@/mocks/mocks')
	await import('@/emby/emby')
	await import('@/emby/collections')
	await import('@/emby/search')
	await import('@/emby/strm')
}
setTimeout(
	() => start().catch(error => console.error(`start -> %O`, error)),
	process.DEVELOPMENT ? 1000 : 1 // wait for 'Debugger attached'
)

import * as inspector from 'inspector'
import exithook = require('exit-hook')
exithook(() => inspector.close()) // inspector must be closed to exit process
