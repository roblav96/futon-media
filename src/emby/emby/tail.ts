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

process.nextTick(() => {
	exithook(() => tail.disconnect())
})

let child: execa.ExecaChildProcess<string>
export const tail = {
	async connect() {
		tail.disconnect()
		let [{ LogPath }, [{ Name }]] = (await Promise.all([
			emby.client.get('/System/Info', { silent: true }),
			emby.client.get('/System/Logs', { silent: true }),
		])) as [emby.SystemInfo, emby.SystemLog[]]
		let logfile = path.join(LogPath, Name)
		if (!fs.pathExistsSync(logfile)) throw new Error('!fs.pathExistsSync')
		console.info(`tail connect ->`, path.basename(logfile))
		child = execa('tail', ['-f', '-n', '0', '-s', '0.5', path.basename(logfile)], {
			buffer: false,
			cwd: path.dirname(logfile),
			killSignal: 'SIGKILL',
			stripFinalNewline: false,
		})
		let limbo = ''
		child.stdout.on('data', (chunk: string) => {
			chunk = limbo + (chunk || '').toString()
			// console.warn(`████  chunk  ████ ->`, JSON.stringify(chunk))
			let regex = /(?<stamp>\d{4}\-\d{2}\-\d{2} \d{2}\:\d{2}\:\d{2}\.\d{3}) (?<level>\w+) (?<category>[^\:]+)\: /g
			let matches = Array.from(chunk.matchAll(regex))
			// console.log(`matches ->`, matches)
			for (let i = 0; i < matches.length; i++) {
				let [match, next] = [matches[i], matches[i + 1]]
				// console.log(`match ->`, match)
				let message = chunk.slice(match.index, next ? next.index : Infinity)
				if (next || message.endsWith('\n')) {
					delete match.input
					// console.warn(`tail ->`, message, match)
					rxTail.next({ message, match })
					limbo = ''
					continue
				}
				limbo = message
				// console.warn(`limbo ->`, limbo)
			}
		})
	},

	disconnect() {
		if (!child) return
		console.warn(`tail disconnect ->`)
		child.cancel()
		child.all.destroy()
		child = null
	},
}

const rxTail = new Rx.Subject<{ message: string; match: RegExpMatchArray }>()
export const rxLine = rxTail.pipe(
	// Rx.op.tap(({ message, match }) => console.log(`rxTail message match ->`, message, match)),
	Rx.op.map(({ message, match }) => ({
		category: match.groups.category,
		stamp: new Date(match.groups.stamp).valueOf(),
		level: match.groups.level as 'Debug' | 'Error' | 'Fatal' | 'Info' | 'Warn',
		message: message.slice(match[0].length).trim(),
	})),
	Rx.op.share()
	// Rx.op.tap(line => console.log(`rxTail line ->`, line))
)

export const rxHttp = rxLine.pipe(
	// Rx.op.tap(line => console.log(`rxHttp line ->`, line)),
	Rx.op.filter(({ level, category }) => level == 'Info' && category == 'HttpServer'),
	Rx.op.map(({ message, stamp }) => ({
		stamp,
		match: message.match(/^HTTP (?<method>[DGP]\w+) (?<url>.+)\. UserAgent\: (?<ua>.+)/),
	})),
	Rx.op.filter(({ match }) => _.isArray(match)),
	Rx.op.map(({ match, stamp }) => ({
		...qs.parseUrl(match.groups.url),
		method: match.groups.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
		stamp,
		ua: match.groups.ua,
	})),
	Rx.op.filter(({ ua }) => ua != emby.client.config.headers['user-agent'].toString()),
	Rx.op.filter(({ method }) => ['GET', 'POST', 'PUT', 'DELETE'].includes(method)),
	Rx.op.filter(({ url }) => /\/emby\//i.test(url) && /\/(images|web)\//i.test(url) == false),
	Rx.op.map(({ method, url, query, stamp, ua }) => {
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
		return { method, url, parts, query, stamp, ua }
	}),
	Rx.op.share()
)
rxHttp.subscribe(({ method, url }) => console.log(`rxHttp ->`, method, url))
