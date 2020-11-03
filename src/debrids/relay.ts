import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as http from '@/adapters/http'
import * as Json from '@/shims/json'
import * as schedule from 'node-schedule'
import * as WS from 'ws'
import Fastify from '@/adapters/fastify'

const fastify = Fastify(process.env.EMBY_PROXY_PORT)
const wss = new WS.Server({
	server: fastify.server,
	path: '/relay',
})
fastify.addHook('onClose', (fastify, done) => wss.close(done))

wss.once('listening', () => {
	schedule.scheduleJob('*/3 * * * * *', async () => {
		let Sessions = await emby.Session.get()
		console.log('Sessions ->', Sessions)
		wss.clients.forEach((ws) => {
			if (ws.readyState != WS.OPEN) return
			ws.send('ping')
			let Session = Sessions.find((v) => v.RemoteEndPoint.includes(ws.remoteAddress))
			if (Session) {
				ws.send(JSON.stringify({ username: Session.UserName }))
			}
		})
	})
})

wss.on('connection', async (ws, request) => {
	ws.remoteAddress = request.socket.remoteAddress
	// console.log('connection ->', request.socket.remoteAddress)
	// console.log('request.headers ->', request.headers)
	// let Sessions = await emby.Session.get(true)
	// // let Sessions = (await emby.client.get('/Sessions', { silent: true })) as emby.Session[]
	// console.log('Sessions ->', Sessions)
})

declare module 'ws' {
	interface WebSocket extends WS {
		remoteAddress: string
	}
}
