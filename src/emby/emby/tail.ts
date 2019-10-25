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

process.nextTick(() => exithook(() => Tail.disconnect()))

export class Tail {
	private static tail: Tail
	private static busy = false

	static async connect() {
		if (Tail.busy || Tail.tail) return
		Tail.busy = true
		try {
			let [{ LogPath }, [{ Name }]] = (await Promise.all([
				emby.client.get('/System/Info', { silent: true }),
				emby.client.get('/System/Logs', { silent: true }),
			])) as [emby.SystemInfo, emby.SystemLog[]]
			let logfile = path.join(LogPath, Name)
			if (!(await fs.pathExists(logfile))) throw new Error('!fs.pathExists')
			Tail.tail = new Tail(logfile)
		} catch (error) {
			console.error(`Tail connect -> %O`, error.message)
			Tail.reconnect()
		}
		Tail.busy = false
	}
	static reconnect = _.debounce(Tail.connect, 3000)
	static disconnect() {
		if (Tail.tail) {
			console.warn(`Tail disconnect ->`)
			Tail.tail.child.cancel()
			Tail.tail.child.all.destroy()
			Tail.tail.child.all.removeAllListeners()
			Tail.tail = null
		}
		Tail.reconnect()
	}

	child: execa.ExecaChildProcess<string>
	constructor(logfile: string) {
		Tail.disconnect()
		let args = ['--follow=name', '--lines=0', '--sleep-interval=0.1', path.basename(logfile)]
		this.child = execa('tail', args, {
			all: true,
			cwd: path.dirname(logfile),
			stripFinalNewline: false,
		})
		this.child.then(() => Tail.disconnect())
		this.child.catch(error => Tail.disconnect())
		this.child.finally(() => Tail.disconnect())
		this.child.on('close', (code, signal) => Tail.disconnect())
		this.child.on('exit', (code, signal) => Tail.disconnect())
		this.child.on('disconnect', () => Tail.disconnect())
		this.child.on('error', error => Tail.disconnect())
		this.child.all.on('close', () => Tail.disconnect())
		this.child.all.on('end', () => Tail.disconnect())
		this.child.all.on('error', () => Tail.disconnect())
		console.info(`tail connected ->`, path.basename(logfile))

		let limbo = ''
		this.child.all.on('data', (chunk: string) => {
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
				limbo += message
				// console.warn(`limbo ->`, limbo)
			}
		})
	}
}

export const rxTail = new Rx.Subject<{ message: string; match: RegExpMatchArray }>()
export const rxLine = rxTail.pipe(
	// Rx.op.tap(({ message, match }) => console.log(`rxTail message match ->`, message, match)),
	Rx.op.map(({ message, match }) => ({
		category: match.groups.category,
		stamp: new Date(match.groups.stamp).valueOf(),
		level: match.groups.level as 'Debug' | 'Error' | 'Fatal' | 'Info' | 'Warn',
		message: message.slice(match[0].length).trim(),
	})),
	Rx.op.share(),
	// Rx.op.tap(line => console.log(`rxTail line ->`, line))
)
// rxLine.subscribe(({ level, category, message }) => {
// 	if (level == 'Info' && category == 'HttpServer') return
// 	console.log(`rxLine ->`, `[${level} ${category}]`, message)
// })

export const rxHttp = rxLine.pipe(
	// Rx.op.tap(line => console.log(`rxHttp line ->`, line)),
	Rx.op.filter(({ level, category }) => level == 'Info' && category == 'HttpServer'),
	Rx.op.map(({ message }) => ({
		match: message.match(/^HTTP (?<method>[DGOP]\w+) (?<url>.+)\. UserAgent\: (?<ua>.+)/),
	})),
	Rx.op.filter(({ match }) => _.isArray(match)),
	Rx.op.map(({ match }) => ({
		...qs.parseUrl(match.groups.url),
		method: match.groups.method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS',
		ua: match.groups.ua,
	})),
	Rx.op.filter(({ url, method }) => {
		url = url.toLowerCase()
		if (!['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].includes(method)) return false
		if (!url.includes('/emby/')) return false
		if (url.includes('/images/') || url.includes('/web/')) return false
		return new Url(url).host != new Url(process.env.EMBY_LAN_ADDRESS).host
	}),
	Rx.op.map(({ method, url, query, ua }) => {
		query = _.mapKeys(query, (v, k) => _.upperFirst(k))
		let pathname = new Url(url).pathname
		let parts = _.compact(pathname.toLowerCase().split('/'))
		for (let i = 0; i < parts.length; i++) {
			let [part, next] = [parts[i], parts[i + 1]]
			if (!next) continue
			if (['users'].includes(part) && next.length == 32) {
				query.UserId = query.UserId || next
			}
			let types = ['items', 'movies', 'shows', 'episodes', 'videos', 'favoriteitems']
			if (types.includes(part) && (utils.isNumeric(next) || next.length == 32)) {
				query.ItemId = query.ItemId || next
			}
		}
		// if (query.ListItemIds) query.ItemId = query.ItemId || query.ListItemIds
		// if (query.SeriesId) query.ItemId = query.ItemId || query.SeriesId
		return { method, url, pathname, parts, query, ua }
	}),
	Rx.op.share(),
)
// rxHttp.subscribe(({ method, pathname, query, ua }) => {
// 	console.log(`rxHttp ->`, method, pathname, query /** , `\n${ua}` */)
// })

export const rxItemId = rxHttp.pipe(
	Rx.op.filter(({ query }) => !!(query.ItemId && query.UserId)),
	Rx.op.map(v => ({ ...v, ItemId: v.query.ItemId, UserId: v.query.UserId })),
	// Rx.op.debounceTime(10),
	// Rx.op.distinctUntilChanged((a, b) => `${a.ItemId}${a.UserId}` == `${b.ItemId}${b.UserId}`),
	// Rx.op.tap(({ ItemId }) => console.log(`rxItemId.tap ->`, ItemId)),
	Rx.op.share(),
)
// rxItemId.subscribe(({ ItemId }) => console.log(`rxItemId ->`, ItemId))

// export const rxItem = rxItemId.pipe(
// 	Rx.op.filter(({ ItemId }) => ItemId.length != 32),
// 	// Rx.op.tap(({ ItemId }) => console.log(`rxItem.tap ->`, ItemId)),
// 	Rx.op.concatMap(async v => {
// 		return { ...v, Item: await emby.library.byItemId(v.ItemId) }
// 	}),
// 	Rx.op.filter(({ Item }) => !!Item && ITEM_TYPES.includes(Item.Type)),
// 	Rx.op.share(),
// )
// rxItem.subscribe(({ ItemId }) => console.log(`rxItem ->`, ItemId))

// export const ITEM_TYPES = ['Movie', 'Series', 'Season', 'Episode', 'Person']
// export const ITEM_ID_PARTS = [
// 	'items',
// 	'movies',
// 	'shows',
// 	'episodes',
// 	'videos',
// 	'favoriteitems',
// 	'playingitems',
// 	'subtitles',
// 	'trailers',
// ]
