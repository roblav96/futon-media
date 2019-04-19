import * as ws from 'ws'

global.WebSocket = ws

declare global {
	namespace NodeJS {
		interface Global {
			WebSocket: typeof ws
		}
	}
}
