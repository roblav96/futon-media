import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/devops/logs'
import '@/devops/development'

// use dynamic imports to avoid circular null references
async function start() {
	await import('@/mocks/mocks')
	await import('@/emby/emby')
	await import('@/emby/collections')
	await import('@/emby/search')
	await import('@/emby/strm')
}
setTimeout(
	() => start().catch(error => console.error(`start -> %O`, error)),
	process.DEVELOPMENT ? 1000 : 1 // wait for Debugger attached
)

import * as inspector from 'inspector'
import exithook = require('exit-hook')
exithook(() => inspector.close())
