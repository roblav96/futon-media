import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fastParse from 'fast-json-parse'
import * as Rx from '@/shims/rxjs'
import * as Url from 'url-parse'
import Sockette from '@/shims/sockette'

process.nextTick(() => {
	let url = `${emby.DOMAIN}:${emby.PORT}`.replace('http', 'ws')
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
			rxMessage.next(value)
		},
	})
})

const rxMessage = new Rx.Subject<EmbyEvent>()
export const rxSocket = rxMessage.pipe(
	Rx.Op.map(EmbyEvent => {
		let { MessageType, MessageId, Data } = EmbyEvent

		MessageType == 'Sessions' &&
			Object.assign(EmbyEvent, {
				MessageType: 'Session',
				Data: new emby.Session(emby.sessions.primaries(Data)[0]),
			})

		return EmbyEvent
	})
)
rxSocket.subscribe(({ MessageType, Data }) => {
	console.log(`rxSocket ->`, MessageType, Data)
})

export function filter<IData>(MessageType: string) {
	return rxSocket.pipe<EmbyEvent<IData>>(
		Rx.Op.filter(EmbyEvent => EmbyEvent.MessageType == MessageType)
	)
}

export interface EmbyEvent<Data = any> {
	Data: Data
	MessageId: string
	MessageType: string
}
