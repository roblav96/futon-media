#!/usr/bin/env node

import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/dev/devtools'

import '@/emby/playback'
import * as playlists from '@/emby/playlists'
import * as schedule from 'node-schedule'
import * as strm from '@/emby/strm'
import * as socket from '@/emby/socket'
import * as emby from '@/emby/emby'
import * as tailLogs from '@/emby/tail-logs'
import * as utils from '@/utils/utils'

async function start() {
	// console.log(`Sessions ->`, await emby.getSessions())
	await playlists.syncPlaylists()
	// tailLogs.watch()
	strm.listen()
	socket.listen()
	if (!process.env.DEVELOPMENT) {
		schedule.scheduleJob(`0 0 * * *`, playlists.syncPlaylists)
	}
}
process.nextTick(async () => {
	process.env.DEVELOPMENT && (await utils.pTimeout(1000))
	return start().catch(error => console.error(`start -> %O`, error))
})
