declare module 'simple-get' {
	import * as http from 'http'

	namespace SimpleGet {
		interface RequestOptions extends http.RequestOptions {
			method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'HEAD' | 'DELETE'
			url: string
			body: any
			form: any
			json: boolean
			maxRedirects: number
		}

		interface ResponseCallback {
			(error: Error, res: http.IncomingMessage, data?: Buffer | string): void
		}
	}

	interface SimpleGet {
		concat(opts: Partial<SimpleGet.RequestOptions>, cb: SimpleGet.ResponseCallback): void
		get(opts: Partial<SimpleGet.RequestOptions>, cb: SimpleGet.ResponseCallback): void
		head(opts: Partial<SimpleGet.RequestOptions>, cb: SimpleGet.ResponseCallback): void
		patch(opts: Partial<SimpleGet.RequestOptions>, cb: SimpleGet.ResponseCallback): void
		post(opts: Partial<SimpleGet.RequestOptions>, cb: SimpleGet.ResponseCallback): void
		put(opts: Partial<SimpleGet.RequestOptions>, cb: SimpleGet.ResponseCallback): void
	}

	function SimpleGet(
		opts: Partial<SimpleGet.RequestOptions>,
		cb: SimpleGet.ResponseCallback
	): void

	export = SimpleGet
}
