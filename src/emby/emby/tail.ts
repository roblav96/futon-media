import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as execa from 'execa'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as qs from '@/shims/query-string'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import exithook = require('exit-hook')

export const rxTail = new Rx.Subject<string>()

export class Tail {
	static tail: Tail
	static logfile: string

	static reconnect = _.debounce(Tail.connect, utils.duration(5, 'second'))
	static async connect() {
		Tail.reconnect()
		if (!Tail.logfile) {
			let [{ LogPath }, [{ Name }]] = (await Promise.all([
				emby.client.get('/System/Info', { silent: true }),
				emby.client.get('/System/Logs', { silent: true }),
			])) as [emby.SystemInfo, emby.SystemLog[]]
			Tail.logfile = path.join(LogPath, Name)
		}
		if (!fs.pathExistsSync(Tail.logfile)) return console.warn(`Tail !fs.pathExistsSync`)
		if (Tail.tail && !Tail.tail.child.killed) return
		Tail.tail = new Tail(Tail.logfile)
	}
	static destroy() {
		Tail.tail && Tail.tail.destroy()
		Tail.reconnect()
	}

	child: execa.ExecaChildProcess
	constructor(logfile: string) {
		console.info(`new Tail ->`, path.basename(logfile))
		this.child = execa('tail', ['-fn0', logfile], { killSignal: 'SIGKILL' })
		this.child.stdout.on('data', (chunk: string) => {
			chunk = `\n${_.trim((chunk || '').toString())}`
			let lines = chunk.split(/\n\d{4}-\d{2}-\d{2}\s/g)
			for (let line of lines) {
				line = _.trim(line || '')
				line && rxTail.next(line)
			}
		})
	}

	destroy = _.once(() => {
		this.child.cancel()
		this.child.stdout.removeAllListeners()
		this.child.stderr.removeAllListeners()
		this.child.removeAllListeners()
		Tail.reconnect()
	})
}

exithook(() => Tail.destroy())

export const rxHttp = rxTail.pipe(
	Rx.op.filter(line => !!line.match(/Info HttpServer: HTTP [DGP]/)),
	Rx.op.map(line => {
		let matches = (line.match(/\b([DGP].*)\s(http.*)\.\s\b/) || []) as string[]
		return [matches[1], matches[2]]
	}),
	Rx.op.filter(matches => matches.filter(Boolean).length == 2),
	Rx.op.map(matches => {
		return { ...qs.parseUrl(matches[1]), method: matches[0] as 'GET' | 'POST' | 'DELETE' }
	}),
	Rx.op.filter(({ url }) => url.toLowerCase().includes('/emby/')),
	// Rx.op.filter(({ url }) => {
	// 	return !['/bower_components/', '/images/', '/web/'].find(v => url.toLowerCase().includes(v))
	// }),
	Rx.op.map(({ method, url, query }) => {
		query = _.mapKeys(query, (v, k) => _.upperFirst(k))
		let pathname = new Url(url).pathname.toLowerCase()
		let parts = pathname.split('/').filter(Boolean)
		for (let i = 0; i < parts.length; i++) {
			let [part, next] = [parts[i], parts[i + 1]]
			if (!next) continue
			if (part == 'users' && next.length == 32) query.UserId = next
			if (['items', 'movies', 'shows', 'episodes', 'favoriteitems'].includes(part)) {
				if (utils.isNumeric(next) || next.length == 32) query.ItemId = next
			}
		}
		return { method, url, parts, query }
	})
)

rxHttp.subscribe(({ method, url, query }) => {
	console.log(`rxHttp ->`, method, url, query)
})

// export interface TailHttp {
// 	method: 'GET' | 'POST' | 'DELETE'
// 	parts: string[]
// 	query: Record<string, string>
// 	url: string
// }
