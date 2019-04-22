#!/usr/bin/env node

import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/dev/devtools'

// use dynamic imports to avoid undefined circular references
async function start() {
	await import('@/emby/emby')
	// await import('@/emby/playback')
	// await import('@/emby/playlists')
	// await import('@/emby/socket')
	// await import('@/emby/strm-files')
	// await import('@/emby/tail-logs')
}
setTimeout(
	() => start().catch(error => console.error(`start -> %O`, error)),
	process.DEVELOPMENT && 1000 // wait for Debugger attached
)
