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
import exitHook = require('exit-hook')

process.nextTick(() => {
	exitHook(() => Tail.disconnect(true))
	emby.rxSocket.subscribe(({ MessageType }) => {
		if (['OnClose', 'OnError'].includes(MessageType)) Tail.disconnect()
		if (['OnOpen'].includes(MessageType)) Tail.connect()
	})
})

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
	static disconnect(silent = false) {
		if (Tail.tail) {
			if (silent == false) console.warn(`Tail disconnect ->`)
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
			buffer: false,
			cwd: path.dirname(logfile),
			reject: false,
			stripFinalNewline: false,
		})
		this.child.finally(() => Tail.disconnect())
		console.info(`tail connected ->`, path.basename(logfile))

		let limbo = ''
		this.child.all.on('data', (chunk: string) => {
			chunk = limbo + (chunk || '').toString()
			let regex =
				/(?<stamp>\d{4}\-\d{2}\-\d{2} \d{2}\:\d{2}\:\d{2}\.\d{3}) (?<level>\w+) (?<category>[^\:]+)\: /g
			let matches = Array.from(chunk.matchAll(regex))
			for (let i = 0; i < matches.length; i++) {
				let [match, next] = [matches[i], matches[i + 1]]
				let message = chunk.slice(match.index, next ? next.index : Infinity)
				if (next || message.endsWith('\n')) {
					delete match.input
					rxTail.next({ message, match })
					limbo = ''
					continue
				}
				limbo += message
			}
		})
	}
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
	Rx.op.share(),
	// Rx.op.tap(line => console.log(`rxTail line ->`, line)),
)
// rxLine.subscribe(({ level, category, message }) => {
// 	if (level == 'Info' && category == 'Server') return
// 	console.log(`rxLine ->`, `[${level} ${category}]`, message)
// })

export const rxHttp = rxLine.pipe(
	// Rx.op.tap(line => console.log(`tap rxHttp line ->`, line)),
	Rx.op.filter(({ level, category }) => level == 'Info' && category == 'Server'),
	Rx.op.map(({ message }) => ({
		match: message.match(
			/^http.+ (?<method>[DGOP]\w+) (?<url>.+)\. UserAgent\: (?<useragent>.+)/,
		),
	})),
	Rx.op.filter(({ match }) => _.isArray(match)),
	Rx.op.map(({ match }) => ({
		...qs.parseUrl(match.groups.url),
		method: match.groups.method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE',
		useragent: match.groups.useragent,
	})),
	Rx.op.filter(({ url, method }) => {
		url = url.toLowerCase()
		if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) return false
		if (url.includes('/images/') || url.includes('/web/')) return false
		return new Url(url).host != new Url(process.env.EMBY_LAN_ADDRESS).host
	}),
	Rx.op.map(({ method, url, query, useragent }) => {
		query = _.mapKeys(query, (v, k) => _.upperFirst(k))
		let pathname = new Url(url).pathname
		let parts = _.compact(pathname.toLowerCase().split('/'))
		for (let i = 0; i < parts.length; i++) {
			let [part, next] = [parts[i], parts[i + 1]]
			if (!next) continue
			if (['users'].includes(part) && next.length == 32) {
				query.UserId = query.UserId || next
			}
			let types = [
				'collections',
				'episodes',
				'favoriteitems',
				'items',
				'movies',
				'playlists',
				'shows',
				'trailers',
				'videos',
			]
			if (types.includes(part) && (utils.isNumeric(next) || next.length == 32)) {
				query.ItemId = query.ItemId || next
			}
		}
		// if (query.ListItemIds) query.ItemId = query.ItemId || query.ListItemIds
		// if (query.SeriesId) query.ItemId = query.ItemId || query.SeriesId
		return { method, url, pathname, parts, query, useragent }
	}),
	Rx.op.share(),
)
// rxHttp.subscribe(({ method, pathname, query, useragent }) => {
// 	console.log(`rxHttp ->`, method, pathname, query /** , `\n${useragent}` */)
// })

export const rxItemId = rxHttp.pipe(
	Rx.op.filter(({ query }) => !!query.ItemId && !!query.UserId),
	Rx.op.map((v) => ({ ...v, ItemId: v.query.ItemId, UserId: v.query.UserId })),
	// Rx.op.debounceTime(10),
	// Rx.op.distinctUntilChanged((a, b) => `${a.ItemId}${a.UserId}` == `${b.ItemId}${b.UserId}`),
	// Rx.op.tap(({ ItemId }) => console.log(`tap rxItemId ->`, ItemId)),
	Rx.op.share(),
)
// rxItemId.subscribe(({ ItemId }) => console.log(`rxItemId ->`, ItemId))

export const rxItem = rxItemId.pipe(
	Rx.op.filter(({ method, parts }) => method != 'DELETE' && !parts.includes('deleteinfo')),
	Rx.op.debounceTime(100),
	Rx.op.distinctUntilKeyChanged('ItemId'),
	// Rx.op.throttleTime(1000, Rx.asyncScheduler, { leading: true, trailing: true }),
	Rx.op.mergeMap(async (v) => {
		let [Item, Session] = await Promise.all([
			emby.library.byItemId(v.ItemId),
			emby.Session.byUserId(v.UserId),
		])
		return { ...v, Item, Session }
	}),
	// Rx.op.tap(({ Item, url }) => console.log(`tap rxItem ->`, emby.library.toTitle(Item), url)),
	Rx.op.share(),
)
// rxItem.subscribe(({ Item }) => console.log(`rxItem ->`, Item))

// export const rxItem = rxItemId.pipe(
// 	Rx.op.filter(({ ItemId }) => ItemId.length != 32),
// 	// Rx.op.tap(({ ItemId }) => console.log(`rxItem.tap ->`, ItemId)),
// 	Rx.op.mergeMap(async v => {
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
