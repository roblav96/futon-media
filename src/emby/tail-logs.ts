import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as qs from 'query-string'
import * as httpie from 'httpie'
import { Tail } from 'tail'
import * as utils from '@/utils/utils'
import * as media from '@/media/media'
import * as trakt from '@/adapters/trakt'
import * as emby from '@/emby/emby'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as debrid from '@/debrids/debrid'
import { LINE, LINK } from '@/dev/mocks'

export async function tailLogs() {
	// return onLine(LINE)
	let { LogPath } = await emby.client.get('/System/Info', { verbose: true })
	let stream = new Tail(path.join(LogPath, 'embyserver.txt'), {
		follow: true,
		separator: /\n\d{4}-\d{2}-\d{2}\s/,
		useWatchFile: true,
	})
	stream.on('line', onLine)
	stream.on('error', error => console.error(`tail Error ->`, error))
}

async function onLine(line: string) {
	line = _.trim(line)
	if (!line.match(/Info HttpServer: HTTP [GP]/)) return
	let fullurl = (line.match(/\b\s(http.*)\.\s\b/) || [])[1] as string
	if (!fullurl) return
	let { url, query } = qs.parseUrl(fullurl)
	if (!query.MediaSourceId) return
	let split = url.split('/')
	let ends = ['PlaybackInfo'].concat(utils.VIDEO_EXTS.map(v => `stream.${v}`))
	if (!ends.includes(split.pop())) return

	let Sessions = (await emby.client.get(`/Sessions`)) as emby.Session[]
	Sessions.sort(
		(a, b) => new Date(b.LastActivityDate).valueOf() - new Date(a.LastActivityDate).valueOf()
	)
	let Session = Sessions.find(v => {
		if (query.UserId) return v.UserId == query.UserId
		if (query.DeviceId) return v.DeviceId == query.DeviceId
	})
	if (!Session) throw new Error(`!Session`)
	!query.UserId && Object.assign(query, { UserId: Session.UserId })
	console.log(`Session ->`, Session)

	return onPlayback({
		...query,
		DeviceName: Session.DeviceName,
		ItemId: split.pop(),
		PlayState: Session.PlayState.MediaSourceId,
		SessionId: Session.Id,
	}).catch(error => {
		console.error(`onPlayback Error ->`, error)
		emby.reportError(Session.Id, error)
	})
}

async function onPlayback({
	DeviceName,
	ItemId,
	MediaSourceId,
	PlayState,
	SessionId,
	UserId,
}: Record<string, string>) {
	console.warn(
		`PlaybackInfo ->`,
		JSON.stringify({ DeviceName, ItemId, MediaSourceId, PlayState, SessionId, UserId })
	)

	let Eitem = (await emby.client.get(`/Users/${UserId}/Items/${ItemId}`, {
		verbose: true,
	})) as emby.Item
	if (!_.size(Eitem)) throw new Error(`!Eitem`)

	if (PlayState) {
		let strm = await fs.readFile(Eitem.Path, 'utf-8')
		if (strm != '/dev/null') {
			await emby.reportMessage(SessionId, `✅ Playing: ${Eitem.Name}`)
			await utils.pTimeout(10000)
			await fs.outputFile(Eitem.Path, '/dev/null')
		}
		return
	}

	let [provider, id] = Object.entries(Eitem.ProviderIds)[0]
	let item = new media.Item(
		((await trakt.client.get(`/search/${provider.toLowerCase()}/${id}`, {
			verbose: true,
		})) as trakt.Result[])[0]
	)
	if (!_.size(item)) throw new Error(`!item`)

	let torrents = await scraper.scrapeAll(item)
	torrents = torrents.filter(v => v.cached.includes('realdebrid'))
	if (!_.size(torrents)) throw new Error(`!torrents`)
	torrents.sort((a, b) => b.seeders - a.seeders)
	let [link] = await debrid.debrids.realdebrid.links(torrents[0].magnet)
	if (!_.size(link)) throw new Error(`!link`)
	link.startsWith('http:') && (link = link.replace('http', 'https'))
	await fs.outputFile(Eitem.Path, link)

	// await emby.refreshLibrary()
	await emby.client.post(`/Sessions/${SessionId}/Playing`, {
		query: { ItemIds: ItemId, PlayCommand: 'PlayNow', MediaSourceId },
		verbose: true,
	})
}
