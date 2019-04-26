import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as media from '@/media/media'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'
import ffprobe from '@/adapters/ffprobe'
import { Premiumize } from '@/debrids/premiumize'
import { RealDebrid } from '@/debrids/realdebrid'

export const debrids = {
	realdebrid: (new RealDebrid() as any) as debrid.Debrid,
	premiumize: (new Premiumize() as any) as debrid.Debrid,
}

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
		let debrid = debrids[torrent.cached[0]]
		let files = debrid.toFiles(await debrid.files(torrent.magnet), torrent.name)
		console.log(`files ->`, files)
		if (files.length == 0) {
			console.warn(`getLink !files ->`, torrent.name)
			continue
		}
		let index = 0
		if (_.isFinite(item.E.n)) {
			if (files.length == item.S.e) {
				index = item.E.n - 1
			}
		}
		let link = await debrid.link(torrent.magnet, files[index])
		if (link) {
			link.startsWith('http:') && (link = link.replace('http:', 'https:'))
			return link
		}
	}
}

export type Debrids = keyof typeof debrids
