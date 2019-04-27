#!/usr/bin/env node

import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/dev/devtools'
import '@/dev/mocks'

// use dynamic imports to avoid circular null references
async function start() {
	await import('@/emby/emby')
	await import('@/emby/playlists')
	await import('@/emby/search')
	await import('@/emby/socket')
	await import('@/emby/strm')
	await import('@/emby/tail')
}
setTimeout(
	() => start().catch(error => console.error(`start -> %O`, error)),
	process.DEVELOPMENT ? 1000 : 1 // wait for Debugger attached
)
