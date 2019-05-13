import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/devops/logs'
import '@/devops/development'
import * as config from '@/emby/config'
import * as pDelay from 'delay'

async function start() {
	await config.setup()
	if (process.DEVELOPMENT) await pDelay(1000) // wait for 'Debugger attached'
	// use dynamic imports to avoid circular null references
	await import('@/mocks/mocks')
	await import('@/emby/emby')
	await import('@/emby/collections')
	await import('@/emby/search')
	await import('@/emby/strm')
}
process.nextTick(() => start().catch(error => console.error(`start -> %O`, error)))

import * as inspector from 'inspector'
import exithook = require('exit-hook')
exithook(() => inspector.close()) // inspector must close for process to exit
