import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as media from '@/media/media'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'
import ffprobe from '@/adapters/ffprobe'
import { Premiumize } from '@/debrids/premiumize'
import { RealDebrid } from '@/debrids/realdebrid'

export const debrids = { realdebrid: RealDebrid, premiumize: Premiumize }

export async function getCached(hashes: string[]) {
	let entries = Object.entries(debrids)
	let resolved = await Promise.all(entries.map(([k, v]) => v.cached(hashes)))
	return hashes.map((v, index) => {
		return entries.map(([key], i) => resolved[i][index] && key).filter(Boolean)
	}) as Debrids[][]
}

export async function getLink(torrents: torrent.Torrent[], item: media.Item) {
	console.log(`getLink torrents ->`, torrents.map(v => v.toJSON()))
	for (let torrent of torrents) {
		console.log(`getLink torrent ->`, torrent.toJSON())

		let debrid = new debrids[torrent.cached[0]](torrent.magnet)
		let files = await debrid.sync()
		if (files.length == 0) {
			console.warn(`getLink !files ->`, torrent.name)
			continue
		}

		let title = item.title
		item.show && (title += ` S${item.S.z}E${item.E.z} ${item.E.t}`)
		let levens = files.map(file => ({ file, leven: utils.leven(file.name, title) }))
		levens.sort((a, b) => a.leven - b.leven)
		console.log(`levens ${title} ->`, levens)
		let file = levens[0].file

		let link = await debrid.link(file)
		if (link) {
			link.startsWith('http:') && (link = link.replace('http:', 'https:'))
			return link
		}
	}
}

export type Debrids = keyof typeof debrids
