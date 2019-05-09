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

			let stream = (await debrid.streamUrl(levens[0]).catch(error => {
				console.error(`getStreamUrl streamUrl -> %O`, error)
			})) as string
			if (!stream) continue
			stream.startsWith('http:') && (stream = stream.replace('http:', 'https:'))

			console.log(`getStreamUrl probe ->`, stream)
			let probe = (await ffprobe(stream, { streams: true }).catch(error => {
				console.error(`getStreamUrl ffprobe -> %O`, error)
			})) as FFProbe
			if (!probe) continue

			let video = probe.streams.find(v => v.codec_type == 'video')
			if (video.tags.language) {
				let language = video.tags.language
				if (!(language.startsWith('en') || language.startsWith('un'))) {
					console.warn(`getStreamUrl probe !video english ->`, torrent.name)
					next = true
					continue
				}
			}
			if (_.size(codecs) > 0) {
				let codec = codecs.find(v => v.includes(video.codec_name))
				if (!codec) {
					console.warn(`getStreamUrl probe !codecs ->`, torrent.name, video.codec_name)
					next = true
					continue
				}
			}

			let audio = probe.streams.find(v => v.codec_type == 'audio')
			if (audio.tags.language) {
				let language = audio.tags.language
				if (!(language.startsWith('en') || language.startsWith('un'))) {
					console.warn(`getStreamUrl probe !audio english ->`, torrent.name)
					next = true
					continue
				}
			}
			if (audio.channels > channels) {
				console.warn(`getStreamUrl probe !channels ->`, torrent.name, audio.channels)
				next = true
				continue
			}

			return stream
		}
	}
}

export type Debrids = keyof typeof debrids
