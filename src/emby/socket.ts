import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fastParse from 'fast-json-parse'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as Url from 'url-parse'
import Sockette from '@/shims/sockette'

const conns = [] as ReturnType<typeof create>[]

process.nextTick(async () => {
	conns.push(create())
	let DeviceIds = _.uniq((await emby.sessions.get()).map(v => v.DeviceId))
	DeviceIds.forEach(v => conns.push(create(v)))
	console.log(`conns ->`, conns)
})

function create(DeviceId = '') {
	let url = `${emby.DOMAIN}:${emby.PORT}`.replace('http', 'ws')
	let query = { api_key: process.env.EMBY_API_KEY } as any
	DeviceId && (query.deviceId = DeviceId)
	let ws = new Sockette(`${url}/embywebsocket?${qs.stringify(query)}`, {
		timeout: 1000,
		maxAttempts: Infinity,
		onerror({ error }) {
			console.error(`socket onerror -> %O`, error)
		},
		onclose({ code, reason }) {
			console.warn(`socket onclose ->`, code, reason)
		},
		onopen({ target }) {
			console.info(`socket onopen ->`, target.url)
			ws.json({ MessageType: 'SessionsStart', Data: '0,1000' })
			// ws.json({ MessageType: 'ScheduledTasksInfoStart', Data: '0,1000' })
			// ws.json({ MessageType: 'ActivityLogEntryStart', Data: '0,1000' })
		},
		onmessage({ data }) {
			let { err, value } = fastParse(data)
			if (err) return console.error(`socket onmessage -> %O`, err)
			value.DeviceId = DeviceId
			rxSocket.next(value)
		},
	})
	return DeviceId
}

export const rxSocket = new Rx.Subject<EmbyEvent>()
rxSocket.subscribe(({ MessageType, DeviceId, Data }) => {
	if (MessageType == 'Sessions') {
		console.log(`rxSocket ->`, DeviceId, Data[0].DeviceName)
	}
})

// export const rxSocket = rxMessage.pipe(
// 	Rx.Op.map(({ MessageType, MessageId, Data }) => {
// 		if (MessageType == 'Sessions') {
// 			MessageType = 'Session'
// 			Data = new emby.Session(emby.sessions.primaries(Data)[0])
// 		}
// 		return { MessageType, MessageId, Data } as EmbyEvent
// 	})
// )
// rxSocket.subscribe(({ MessageType, Data }) => {
// 	console.log(`rxSocket ->`, MessageType, Data)
// })

export function filter<IData>(MessageType: string) {
	return rxSocket.pipe(
		Rx.Op.filter(EmbyEvent => EmbyEvent.MessageType == MessageType),
		Rx.Op.map(({ Data }) => Data as IData)
	)
}

export interface EmbyEvent<Data = any> {
	Data: Data
	DeviceId: string
	MessageId: string
	MessageType: string
}
