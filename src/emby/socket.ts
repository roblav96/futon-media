import * as _ from 'lodash'
import * as fastParse from 'fast-json-parse'
import * as Rx from '@/shims/rxjs'
import * as Url from 'url-parse'
import Sockette from '@/shims/sockette'

export interface EmbyEvent<Data = any> {
	Data: Data
	MessageId: string
	MessageType: string
}

export const rxSocket = new Rx.Subject<EmbyEvent>()

process.nextTick(() => {
	let url = process.env.EMBY_API_URL.replace('http', 'ws')
	url += `/embywebsocket?api_key=${process.env.EMBY_API_KEY}`
	let ws = new Sockette(url, {
		timeout: 1000,
		maxAttempts: Infinity,
		onerror({ error }) {
			console.error(`socket onerror -> %O`, error)
		},
		onclose({ code, reason }) {
			console.warn(`socket onclose ->`, code, reason)
		},
		onopen({ target }) {
			console.info(`socket onopen ->`, new Url(target.url).origin)
			ws.json({ MessageType: 'SessionsStart', Data: '0,1000' })
			ws.json({ MessageType: 'ScheduledTasksInfoStart', Data: '0,1000' })
			ws.json({ MessageType: 'ActivityLogEntryStart', Data: '0,1000' })
		},
		onmessage({ data }) {
			let { err, value } = fastParse(data)
			if (err) return console.error(`socket onmessage -> %O`, err)
			rxSocket.next(value)
		},
	})
})
