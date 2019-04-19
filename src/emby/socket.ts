import Sockette from 'sockette'
import * as _ from 'lodash'
import * as WebSocket from 'ws'
import * as fastParse from 'fast-json-parse'
import * as utils from '@/utils/utils'
import * as trakt from '@/adapters/trakt'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as Url from 'url-parse'
import { Emitter } from '@/utils/emitter'

const sockette = require('sockette') as typeof Sockette
;(global as any).WebSocket = WebSocket

export interface EmbyEvents {
	Sessions: emby.Session[]
}

class Socket extends Emitter<EmbyEvents> {
	private sockette: Sockette
	constructor(public url: string) {
		super()
		this.sockette = new sockette(url, {
			timeout: 1000,
			maxAttempts: Infinity,
			onerror(error) {
				console.error(`onerror Error ->`, error)
			},
			onopen(message) {
				console.info(`onopen ->`, new Url(message.target.url).origin)
				ws.json({ MessageType: 'SessionsStart', Data: '0,1000' })
				ws.json({ MessageType: 'ScheduledTasksInfoStart', Data: '0,1000' })
				ws.json({ MessageType: 'ActivityLogEntryStart', Data: '0,1000' })
			},
			onmessage(message) {
				let { MessageType, Data } = fastParse(message.data).value || message.data
				if (MessageType == 'Sessions' && _.isArray(Data)) {
					let Sessions = emby.sortSessions(Data)
					// return
				}
				console.log(`onmessage ->`, MessageType, Data)
			},
		})
	}
}
export const socket = new Socket()

export function listen() {
	let url = process.env.EMBY_API_URL.replace('http', 'ws')
	url += `/embywebsocket?api_key=${process.env.EMBY_API_KEY}` // &deviceId=fdda82b88945e506
}
