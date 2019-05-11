import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as fastParse from 'fast-json-parse'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as Url from 'url-parse'
import Sockette from '@/shims/sockette'

export const rxSocket = new Rx.Subject<EmbyEvent>()

process.nextTick(async () => {
	let url = `${emby.DOMAIN}:${emby.PORT}`.replace('http', 'ws')
	let query = { api_key: process.env.EMBY_API_KEY }
	let ws = new Sockette(`${url}/embywebsocket?${qs.stringify(query)}`, {
		timeout: 3000,
		maxAttempts: Infinity,
		onerror({ error }) {
			console.error(`emby onerror -> %O`, error)
		},
		onclose({ code, reason }) {
			console.warn(`emby onclose ->`, code, reason)
		},
		onopen({ target }) {
			console.info(`emby onopen ->`, new Url(target.url).pathname)
			ws.json({ MessageType: 'SessionsStart', Data: '0,1000' })
			ws.json({ MessageType: 'ScheduledTasksInfoStart', Data: '0,1000' })
			ws.json({ MessageType: 'ActivityLogEntryStart', Data: '0,1000' })
		},
		onmessage({ data }) {
			let { err, value } = fastParse(data)
			if (err) return console.error(`emby onmessage -> %O`, err)
			rxSocket.next(value)
		},
	})
})

export const socket = {
	filter<IData>(MessageType: string) {
		return rxSocket.pipe(
			Rx.op.filter(EmbyEvent => EmbyEvent.MessageType == MessageType),
			Rx.op.map(({ Data }) => Data as IData)
		)
	},
}

// socket.filter<emby.Session[]>('Sessions').subscribe(async () => {})

// export const rxSessions = socket.filter<emby.Session[]>('Sessions').pipe(
// 	Rx.Op.map(Sessions => {
// 		Sessions = Sessions.filter(({ UserName }) => !!UserName).map(v => new emby.Session(v))
// 		return Sessions.sort((a, b) => b.Stamp - a.Stamp)
// 	})
// )

export interface EmbyEvent<Data = any> {
	Data: Data
	MessageId: string
	MessageType: string
}

// rxSocket.subscribe(({ MessageType, Data }) => {
// 	if (MessageType == 'Sessions') {
// 		let Sessions = emby.sessions.parse(Data)
// 		// console.log(`Sessions ->`, Sessions)
// 		// console.log(`rxSocket ->`, Sessions.map(v => `${v.DeviceName} -> ${v.age}`))
// 	}
// })

// export const rxSocket = rxMessage.pipe(
// 	Rx.Op.map(({ MessageType, MessageId, Data }) => {
// 		if (MessageType == 'Sessions') {
// 			MessageType = 'Session'
// 			Data = emby.sessions.parse(Data)[0]
// 		}
// 		return { MessageType, MessageId, Data } as EmbyEvent
// 	})
// )
// rxSocket.subscribe(({ MessageType, Data }) => {
// 	console.log(`rxSocket ->`, MessageType, Data)
// })
