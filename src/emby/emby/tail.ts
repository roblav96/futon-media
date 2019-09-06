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
		tail.child = execa('tail', ['-f', '-n', '0', '-s', '0.3', path.basename(logfile)], {
			cwd: path.dirname(logfile),
			killSignal: 'SIGKILL',
			stripFinalNewline: false,
		})
		let remainder = ''
		tail.child.stdout.on('data', (chunk: string) => {
			chunk = (chunk || '').toString()
			if (remainder) {
				chunk = `${remainder}${chunk}`
				remainder = ''
			}
			// console.warn(`chunk ->`, chunk)
			let chunks = `\n${chunk}`.split(/\n\d{4}\-\d{2}\-\d{2}\s\d{2}\:\d{2}\:\d{2}\.\d{3}\s\b/)
			let last = _.last(chunks)
			if (!last.endsWith(`\n`)) {
				remainder = chunks.pop()
			}
			chunks = chunks.map(v => v && v.trim()).filter(Boolean)
			// console.log(`chunks ->`, chunks)
			chunks.forEach(v => rxChunk.next(v))
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

export const rxChunk = new Rx.Subject<string>()
rxChunk.subscribe(chunk => {
	// console.warn(`rxChunk ->`, chunk)
})

export const rxLine = rxChunk.pipe(
	Rx.op.map(chunk => {
		console.warn(`chunk ->`, chunk)
		let level = chunk.slice(0, chunk.indexOf(' '))
		chunk = chunk.replace(`${level} `, '')
		let category = chunk.slice(0, chunk.indexOf(':'))
		chunk = chunk.replace(`${category}: `, '')
		return { level, category, chunk }
	})
)
rxLine.subscribe(line => {
	console.log(`rxLine ->`, line)
})

export const rxHttp = rxChunk.pipe(
	Rx.op.filter(line => !!line.match(/^Info HttpServer: HTTP [DGP]/)),
	Rx.op.filter(line => !line.includes(emby.client.config.headers['user-agent'].toString())),
	Rx.op.map(line => {
		let matches = line.match(/\b([DGP].*)\s(http.*)\.\s\b/) || []
		return [matches[1], matches[2], line.slice(0, line.indexOf(' '))]
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
