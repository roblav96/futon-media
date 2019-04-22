import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as mocks from '@/dev/mocks'
import * as path from 'path'
import * as qs from 'query-string'
import * as Rx from '@/utils/rxjs'
import * as utils from '@/utils/utils'
import { Tail } from 'tail'

export const rxLine = new Rx.Subject<string>()
export const rxHttp = rxLine.pipe(
	Rx.Op.map(line => {
		if (!line.match(/Info HttpServer: HTTP [GP]/)) return
		let match = (line.match(/\b\s(http.*)\.\s\b/) || [])[1] as string
		if (!match) return
		let { url, query } = qs.parseUrl(match)
		return { url, query: JSON.parse(JSON.stringify(query || {})) as Record<string, string> }
	}),
	Rx.Op.filter(v => !!v)
)

_.once(async () => {
	// return rxLine.next(mocks.LINE)
	let { LogPath } = await emby.client.get('/System/Info')
	let stream = new Tail(path.join(LogPath, 'embyserver.txt'), {
		follow: true,
		separator: /\n\d{4}-\d{2}-\d{2}\s/,
		useWatchFile: true,
	})
	stream.on('line', line => rxLine.next(_.trim(line)))
	stream.on('error', error => console.error(`tailLogs stream -> %O`, error))
})()
