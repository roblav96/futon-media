declare module 'simple-concat' {
	import { IncomingMessage } from 'http'

	function simpleconcat(
		response: IncomingMessage,
		callback: (error: Error, data: Buffer) => void,
	): void

	namespace simpleconcat {}
	export = simpleconcat
}
