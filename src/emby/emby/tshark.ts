import * as Json from '@/shims/json'
import * as Rx from '@/shims/rxjs'
import exitHook = require('exit-hook')
import Sockette, { ISockette } from '@/shims/sockette'

process.nextTick(() => {
	let ws = new Sockette('ws://127.0.0.1:18100', {
		timeout: 3000,
		onerror({ error }) {
			console.error(`tshark onerror -> %O`, error.message)
		},
		onclose({ code, reason }) {
			console.warn(`tshark onclose ->`, code, reason)
		},
		onopen({ target }) {
			let url = target.url as string
			console.info(`tshark onopen ->`, url.slice(0, url.indexOf('?')))
		},
		onmessage({ data }) {
			let { error, value } = Json.parse(data)
			if (error) return console.error(`tshark onmessage -> %O`, error.message)
			console.log(`tshark onmessage ->`, value)
		},
	})
	exitHook(() => ws.close())
})

export const rxTShark = new Rx.Subject<Partial<TSharkEvent>>()

interface TSharkEvent {
	layers: {
		frame: {
			filtered: string
		}
		http: {
			http_http_accept: string
			http_http_connection: string
			http_http_host: string
			http_http_request: boolean
			http_http_request_full_uri: string
			http_http_request_line: string[]
			http_http_request_method: string
			http_http_request_number: string
			http_http_request_uri: string
			http_http_request_uri_path: string
			http_http_request_uri_query: string
			http_http_request_uri_query_parameter: string
			http_http_request_version: string
			http_http_user_agent: string
			text: string[]
		}
		ip: {
			filtered: string
		}
		null: {
			filtered: string
		}
		tcp: {
			filtered: string
		}
	}
	timestamp: string
}
