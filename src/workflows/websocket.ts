import Sockette from 'sockette'
import * as _ from 'lodash'
import * as WebSocket from 'ws'
import * as fastParse from 'fast-json-parse'
import * as utils from '@/utils/utils'
import * as trakt from '@/adapters/trakt'
import * as emby from '@/adapters/emby'
import * as media from '@/media/media'

const sockette = require('sockette') as typeof Sockette
;(global as any).WebSocket = WebSocket

export function listen() {
	let url = process.env.EMBY_API_URL.replace('http', 'ws')
	url += `/embywebsocket?api_key=${process.env.EMBY_API_KEY}` // &deviceId=fdda82b88945e506
	let ws = new sockette(url, {
		timeout: 1000,
		maxAttempts: Infinity,
		onerror(error) {
			console.error(`onerror Error ->`, error)
		},
		onopen(message) {
			console.info(`onopen ->`, message.target.url)
			ws.json({ MessageType: 'SessionsStart', Data: '1000,1000' })
			ws.json({ MessageType: 'ScheduledTasksInfoStart', Data: '1000,1000' })
			ws.json({ MessageType: 'ActivityLogEntryStart', Data: '1000,1000' })
		},
		onmessage(message) {
			let { MessageType, Data } = fastParse(message.data).value || message.data
			if (MessageType == 'Sessions' && _.isArray(Data)) {
				// let session = Data.find(v => v.UserName == 'Developer')
				let dates = Data.map(v => new Date(v.LastActivityDate).toLocaleTimeString())
				console.log(`dates ->`, dates)
			} else {
				console.log(`onmessage ->`, MessageType, Data)
			}
		},
	})
	return ws
}
