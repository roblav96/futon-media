declare module 'simple-get' {
	import * as http from 'http'
	import * as https from 'https'

	namespace SimpleGet {
		interface Options extends https.RequestOptions {
			method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'HEAD' | 'DELETE'
			url?: string
			body?: any
			form?: any
			json?: boolean
			maxRedirects?: number
		}

		interface Request extends http.ClientRequest {}

		interface Response extends http.IncomingMessage {}

		interface Callback {
			(error: Error, response: Response, data?: Buffer | string): void
		}

		function concat(options: Options, callback: Callback): Request
		function get(options: Options, callback: Callback): Request
		function head(options: Options, callback: Callback): Request
		function patch(options: Options, callback: Callback): Request
		function post(options: Options, callback: Callback): Request
		function put(options: Options, callback: Callback): Request
	}

	function SimpleGet(
		options: SimpleGet.Options,
		callback: SimpleGet.Callback
	): SimpleGet.Request

	export = SimpleGet
}
