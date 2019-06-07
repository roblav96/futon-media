import * as ws from 'ws'
;(global as any).WebSocket = ws

import ISockette from 'sockette'
export { ISockette }
export default require('sockette') as typeof ISockette
export * from 'sockette'

declare module 'sockette' {
	interface Event {
		error: Error
		message: string
		target: any
		type: string
	}
	interface MessageEvent extends Event {
		data: any
	}
	interface CloseEvent extends Event {
		code: number
		reason: string
		wasClean: boolean
	}
}
