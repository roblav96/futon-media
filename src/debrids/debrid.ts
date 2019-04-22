import * as _ from 'lodash'
import * as media from '@/media/media'
import * as pForever from 'p-forever'
import * as torrent from '@/scrapers/torrent'
import { premiumize } from '@/debrids/premiumize'
import { realdebrid } from '@/debrids/realdebrid'

export interface Debrid {
	cached(hashes: string[]): Promise<boolean[]>
	files(magnet: string): Promise<File[]>
	link(magnet: string, index: number): Promise<string>
}

export const debrids = { realdebrid, premiumize }
export const entries = Object.entries(debrids)

export async function getCached(hashes: string[]) {
	let resolved = await Promise.all(entries.map(([k, v]) => v.cached(hashes)))
	return hashes.map((v, index) => {
		return entries.map(([key], i) => resolved[i][index] && key).filter(Boolean)
	}) as Debrids[][]
}

export async function getLink(torrents: torrent.Torrent[], item: media.Item) {
	let episodes = item.episode && (item.season.episode_count || item.season.aired_episodes)
	for (let torrent of torrents) {
		console.log(`getLink torrent ->`, torrent.toJSON())
		let debrid = debrids[torrent.cached[0]]
		let files = await debrid.files(torrent.magnet)
		if (files.length == 0) {
			console.warn(`getLink files.length == 0 ->`, torrent.name)
			continue
		}
		let index = 0
		if (item.episode && files.length == episodes) {
			index = item.E.n
		}
		let link = await debrid.link(torrent.magnet, index)
		if (link) {
			link.startsWith('http:') && (link = link.replace('http', 'https'))
			return link
		}
	}
}

export type Debrids = keyof typeof debrids

export interface File {
	bytes: number
	name: string
	path: string
}
