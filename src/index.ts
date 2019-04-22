#!/usr/bin/env node

import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/dev/devtools'

import '@/emby/strm-playback'
import * as playlists from '@/emby/playlists'
import * as schedule from 'node-schedule'
import * as socket from '@/emby/socket'
import * as tailLogs from '@/emby/tail-logs'
import * as utils from '@/utils/utils'

async function start() {
	// return playlists.syncPlaylists()
	tailLogs.watch()
	socket.listen()
	if (!process.env.DEVELOPMENT) {
		schedule.scheduleJob(`0 0 * * *`, playlists.syncPlaylists)
	}
}
process.nextTick(async () => {
	process.env.DEVELOPMENT && (await utils.pTimeout(1000))
	return start().catch(error => console.error(`start Error ->`, error))
})
