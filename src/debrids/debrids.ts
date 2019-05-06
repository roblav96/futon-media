import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as media from '@/media/media'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'
import ffprobe, { FFProbe } from '@/adapters/ffprobe'
import { Premiumize } from '@/debrids/premiumize'
import { Putio } from '@/debrids/putio'
import { RealDebrid } from '@/debrids/realdebrid'

export const debrids = { premiumize: Premiumize, realdebrid: RealDebrid, putio: Putio }

export async function cached(hashes: string[]) {
	let entries = Object.entries(debrids)
	let resolved = await Promise.all(entries.map(([k, v]) => v.cached(hashes)))
	return hashes.map((v, index) => {
		return entries.map(([key], i) => resolved[i][index] && key).filter(Boolean)
	}) as Debrids[][]
}

export async function getStreamUrl(
	torrents: torrent.Torrent[],
	item: media.Item,
	channels: number,
	codecs: string[]
) {
	for (let torrent of torrents) {
		let next = false
		for (let cached of torrent.cached) {
			if (next) continue
			console.log(`getStreamUrl '${cached}' torrent ->`, torrent.json)
			let debrid = new debrids[cached]().use(torrent.magnet)
			let files = (await debrid.getFiles().catch(error => {
				console.error(`getStreamUrl getFiles -> %O`, error)
			})) as debrid.File[]
			if (!files) continue
			if (files.length == 0) {
				console.warn(`getStreamUrl !files ->`, torrent.name)
				next = true
				continue
			}

			let title = item.title
			item.show && (title += ` S${item.S.z}E${item.E.z} ${item.E.t}`)
			let levens = files.map(file => ({ ...file, leven: utils.leven(file.name, title) }))
			levens.sort((a, b) => a.leven - b.leven)
			console.log(`getStreamUrl levens ->`, torrent.name, levens)

			let stream = await debrid.streamUrl(levens[0]).catch(error => {
				console.error(`getStreamUrl streamUrl -> %O`, error)
			})
			if (!stream) continue

			stream.startsWith('http:') && (stream = stream.replace('http:', 'https:'))
			let probe = (await ffprobe(stream, { streams: true }).catch(error => {
				console.error(`getStreamUrl ffprobe -> %O`, error)
			})) as FFProbe
			if (!probe) {
				next = true
				continue
			}
			console.log(`getStreamUrl probe ->`, stream)

			if (!probe.streams.find(v => v.channels <= channels)) {
				console.warn(`getStreamUrl probe !channels ->`, torrent.name, channels)
				next = true
				continue
			}

			let video = probe.streams.find(
				v => v.codec_type && v.codec_type.toLowerCase() == 'video'
			)
			if (_.size(codecs) > 0 && !codecs.includes(video.codec_name.toLowerCase())) {
				console.warn(`getStreamUrl probe !codec ->`, torrent.name, video.codec_name)
				next = true
				continue
			}

			let english = probe.streams.find(v => {
				if (v.codec_type.toLowerCase() == 'audio') {
					if (v.tags.language) {
						let language = v.tags.language.toLowerCase()
						return language.startsWith('en') || language.startsWith('un')
					}
					return !!_.keys(v.tags).find(v => v.toLowerCase().endsWith('eng'))
				}
			})
			if (!english) {
				console.warn(`getStreamUrl probe !english ->`, torrent.name)
				next = true
				continue
			}

			return stream
		}
	}
}

export type Debrids = keyof typeof debrids
