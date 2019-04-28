import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as path from 'path'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import { Tail } from 'tail'

export const rxTail = new Rx.Subject<string>()

process.nextTick(async () => {
	let { LogPath } = await emby.client.get('/System/Info', { silent: true })
	let stream = new Tail(path.join(LogPath, 'embyserver.txt'), {
		follow: true,
		separator: /\n\d{4}-\d{2}-\d{2}\s/,
		useWatchFile: true,
	})
	stream.on('line', line => rxTail.next(_.trim(line)))
	stream.on('error', error => console.error(`tailLogs stream -> %O`, error))
})

const JUNK = [
	// 'backdrop/0',
	// 'capabilities/full',
	// 'displaypreferences/usersettings',
	// 'emby/openapi',
	'info/public',
	// 'playing/progress',
	'strings/en-us.json',
	'system/endpoint',
	'system/info',
	'.png',
	'system/wakeonlaninfo',
	'web/manifest.json',
]
export const rxHttp = rxTail.pipe(
	Rx.Op.map(line => {
		if (line.match(/Info HttpServer: HTTP [DGP]/)) {
			return (line.match(/\b\s(http.*)\.\s\b/) || [])[1] as string
		}
	}),
	Rx.Op.filter(match => !!match),
	Rx.Op.map(match => qs.parseUrl(match) as { url: string; query: Record<string, string> }),
	Rx.Op.filter(({ url }) => !JUNK.find(v => url.toLowerCase().endsWith(v))),
	Rx.Op.map(({ url, query }) => {
		query = _.mapKeys(query, (v, k) => _.upperFirst(k))
		let parts = new Url(url).pathname.toLowerCase().split('/')
		for (let i = 0; i < parts.length; i++) {
			let [part, next] = [parts[i], parts[i + 1]]
			if (part == 'users' && !!next) {
				query.UserId = next
			}
			if (['items', 'movies', 'shows', 'episodes'].includes(part) && utils.isNumeric(next)) {
				query.ItemId = next
			}
		}
		return { url, query }
	})
)
