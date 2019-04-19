#!/usr/bin/env node

import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/dev/devtools'
import '@/utils/shims'

import '@/emby/strm-playback'
import * as socket from '@/emby/socket'
import * as tailLogs from '@/emby/tail-logs'
import * as utils from '@/utils/utils'
import { scheduleJob } from 'node-schedule'
import { syncPlaylists } from '@/emby/playlists'

async function start() {
	if (!process.env.DEVELOPMENT) {
		scheduleJob(`0 0 * * *`, syncPlaylists)
	}
	// return syncPlaylists()
	tailLogs.watch()
	socket.listen()
}
process.nextTick(async () => {
	process.env.DEVELOPMENT && (await utils.pTimeout(1000))
	return start().catch(error => {
		console.error(`start Error ->`, error)
	})
})
