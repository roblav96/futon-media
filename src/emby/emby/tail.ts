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

export const tail = {
	child: null as execa.ExecaChildProcess<string>,

	async connect() {
		tail.disconnect()
		let [{ LogPath }, [{ Name }]] = (await Promise.all([
			emby.client.get('/System/Info', { silent: true }),
			emby.client.get('/System/Logs', { silent: true }),
		])) as [emby.SystemInfo, emby.SystemLog[]]
		let logfile = path.join(LogPath, Name)
		if (!fs.pathExistsSync(logfile)) throw new Error('!fs.pathExistsSync')
		console.info(`tail connect ->`, path.basename(logfile))
		tail.child = execa('tail', ['-f', '-n', '0', '-s', '0.5', path.basename(logfile)], {
			buffer: false,
			cwd: path.dirname(logfile),
			// killSignal: 'SIGKILL',
			stripFinalNewline: false,
		})
		let limbo = ''
		tail.child.stdout.on('data', (chunk: string) => {
			chunk = limbo + (chunk || '').toString()
			console.warn(`████  chunk  ████ ->`, JSON.stringify(chunk))
			// let result = /\d{4}\-\d{2}\-\d{2}\s\d{2}\:\d{2}\:\d{2}\.\d{3}\s/.exec(chunk)
			// console.log(`result ->`, result)
			// // let result: RegExpExecArray
			// // while (result = /\d{4}\-\d{2}\-\d{2}\s\d{2}\:\d{2}\:\d{2}\.\d{3}\s/.exec(chunk)) {
			// // 	console.log(`result ->`, result)
			// // 	console.log(`result ->`, result)
			// // }
			// chunk = ''

			let regex = /(\d{4}\-\d{2}\-\d{2} \d{2}\:\d{2}\:\d{2}\.\d{3}) (\w+) (\w+)\: /g
			let matches = (Array.from((chunk as any).matchAll(regex)) as RegExpMatchArray[]).map(
				v => {
					delete v.input
					return v
				}
			)
			console.log(`matches ->`, matches)
			for (let i = 0; i < matches.length; i++) {
				let match = matches[i]
				console.log(`match ->`, match)
				let next = matches[i + 1]
				let line = chunk.slice(match.index, next ? next.index : Infinity)
				if (next || line.endsWith('\n')) {
					rxMatch.next({ line, match })
					console.log(`{ line, match } ->`, { line, match })
					limbo = ''
					continue
				}
				limbo = line
				console.warn(`limbo ->`, limbo)
			}

			// let regex = /(\d{4}\-\d{2}\-\d{2} \d{2}\:\d{2}\:\d{2}\.\d{3}) (Debug|Error|Info) /
			// let chunks = chunk.split(regex).filter(Boolean)
			// console.log(`chunks ->`, chunks)
			// while (Levels[chunks[1]] && /\S\n$/.test(chunks[2])) {
			// 	let stamp = chunks.shift()
			// 	let type = chunks.shift()
			// 	let text = chunks.shift()
			// 	console.log(`line ->`, { stamp, type, text })
			// }
			// console.warn(`limbo chunks ->`, chunks)
			// let limbo = chunks.join(' ')
			// console.warn(`limbo ->`, limbo)
			// data = limbo

			// console.log(`chunks ->`, JSON.stringify(chunks))
			// let last = _.last(chunks)
			// if (!last.endsWith(`\n`)) {
			// 	limbo = chunks.pop()
			// }
			// chunks = chunks.map(v => v && v.trim()).filter(Boolean)
			// // console.log(`chunks ->`, chunks)
			// chunks.forEach(v => rxChunk.next(v))
		})
	},

	disconnect() {
		if (!tail.child) return
		console.warn(`tail disconnect ->`)
		tail.child.cancel()
		tail.child.all.destroy()
		tail.child = null
	},
}

const Levels = { Debug: 'Debug', Error: 'Error', Fatal: 'Fatal', Info: 'Info', Warn: 'Warn' }
const rxMatch = new Rx.Subject<{ line: string; match: RegExpMatchArray }>()
rxMatch.subscribe(match => {
	console.log(`rxMatch ->`, match)
})
const rxLine = rxMatch.pipe(
	Rx.op.map(({ line, match }) => ({
		category: match[3] as string,
		stamp: new Date(match[1]).valueOf(),
		level: match[2] as keyof typeof Levels,
		text: line.slice(match[0].length).trim(),
	})),
	Rx.op.tap(line => console.log(`rxLine ->`, line))
)
// rxLine.subscribe(line => {
// 	console.log(`rxLine ->`, line)
// })

export const rxHttp = rxLine.pipe(
	Rx.op.filter(({ level, category, chunk }) => {
		return level == 'INFO' && category == 'HttpServer' && /^HTTP [DGP]/.test(chunk)
	}),
	Rx.op.filter(
		({ chunk }) => !chunk.includes(emby.client.config.headers['user-agent'].toString())
	),
	Rx.op.map(({ chunk }) => {
		let matches = chunk.match(/\b([DGP].*)\s(http.*)\.\s\b/) || []
		console.log(`matches ->`, matches)
		return [matches[1], matches[2], chunk.slice(0, chunk.indexOf(' '))]
	}),
	Rx.op.filter(matches => matches.filter(Boolean).length == 3),
	Rx.op.map(matches => ({
		...qs.parseUrl(matches[1]),
		method: matches[0] as 'GET' | 'POST' | 'DELETE',
		level: matches[2].toUpperCase() as 'INFO' | 'DEBUG',
	})),
	Rx.op.filter(({ url }) => {
		let lower = url.toLowerCase()
		if (lower.includes('/images/') || lower.includes('/web/')) return
		return lower.includes('/emby/')
	}),
	Rx.op.map(({ method, url, query, level }) => {
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
		return { method, url, parts, query, level }
	})
)
rxHttp.subscribe(({ level, method, url, query }) => {
	// console.log(`rxHttp ->`, level, method, url, query)
})
