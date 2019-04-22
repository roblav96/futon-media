#!/usr/bin/env node

import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/dev/devtools'

setTimeout(() => {
	return Promise.all([
		import('@/emby/emby'),
		import('@/emby/playback'),
		import('@/emby/playlists'),
		import('@/emby/socket'),
		import('@/emby/strm-files'),
		import('@/emby/tail-logs'),
	]).catch(error => console.error(`start -> %O`, error))
}, process.DEVELOPMENT && 1000) // let the debugger attach
