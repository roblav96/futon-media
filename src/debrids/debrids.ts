import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as media from '@/media/media'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'
import ffprobe from '@/adapters/ffprobe'
import { Premiumize } from '@/debrids/premiumize'
import { RealDebrid } from '@/debrids/realdebrid'

export const debrids = { realdebrid: RealDebrid, premiumize: Premiumize }

export async function cached(hashes: string[]) {
	let entries = Object.entries(debrids)
	let resolved = await Promise.all(entries.map(([k, v]) => v.cached(hashes)))
	return hashes.map((v, index) => {
		return entries.map(([key], i) => resolved[i][index] && key).filter(Boolean)
	}) as Debrids[][]
}

export async function download(torrents: torrent.Torrent[], item: media.Item) {
	// console.log(`download torrents ->`, torrents.map(v => v.json()))
	let debrid = new RealDebrid()
	for (let torrent of torrents) {
		if (torrent.cached.includes('realdebrid')) {
			return
		}
		console.log(`download torrent ->`, torrent.json())
		if (await debrid.use(torrent.magnet).download()) {
			return
		}
	}
}

export async function getStream(torrents: torrent.Torrent[], item: media.Item) {
	// console.log(`stream torrents ->`, torrents.map(v => v.json()))
	for (let torrent of torrents) {
		console.log(`stream torrent ->`, torrent.json())

		for (let cached of torrent.cached) {
			let debrid = new debrids[cached]().use(torrent.magnet)
			let files = await debrid.getFiles()
			if (files.length == 0) {
				console.warn(`stream !files ->`, torrent.name)
				continue
			}

			let title = item.title
			item.show && (title += ` S${item.S.z}E${item.E.z} ${item.E.t}`)
			let levens = files.map(file => ({ ...file, leven: utils.leven(file.name, title) }))
			levens.sort((a, b) => a.leven - b.leven)
			console.log(`levens ${title} ->`, levens)

			let stream = await debrid.streamUrl(levens[0])
			if (stream) {
				return stream.startsWith('http:') ? stream.replace('http:', 'https:') : stream
			}
		}
	}
}

export type Debrids = keyof typeof debrids
