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

			let file: debrid.File
			if (item.type == 'show') {
				let tests = [
					`S${item.S.z}E${item.E.z}`,
					`S${item.S.z}xE${item.E.z}`,
					`${item.S.n}x${item.E.z}`,
					`${item.S.n}x${item.E.n}`,
					`${item.S.n}${item.E.z}`,
					`Episode${item.E.z}`,
					`Ep${item.E.z}`,
					`E${item.E.z}`,
					`${item.E.z}`,
				]
				console.log(`tests ->`, JSON.stringify(tests))
				for (let test of tests) {
					if (file) continue
					file = files.find(v => {
						console.warn(`v.name ->`, v.name)
						let name = utils.accuracy(`${item.title} ${item.year}`, v.name).join(' ')
						console.log(`name ->`, name)
						console.log(`accuracy ->`, utils.accuracy(name, test))
						return utils.accuracy(name, test).length == 0
					})
				}
			}
			if (!file) {
				let title = item.title
				item.show && (title += ` S${item.S.z}E${item.E.z} ${item.E.t}`)
				let levens = files.map(file => ({ ...file, leven: utils.leven(file.name, title) }))
				file = levens.sort((a, b) => a.leven - b.leven)[0]
			}
			console.log(`file ->`, file)

			let stream = (await debrid.streamUrl(file).catch(error => {
				console.error(`getStreamUrl streamUrl -> %O`, error)
			})) as string
			if (!stream) continue
			stream.startsWith('http:') && (stream = stream.replace('http:', 'https:'))

			console.log(`getStreamUrl probe ->`, stream)
			let probe = (await ffprobe(stream, { streams: true }).catch(error => {
				console.error(`getStreamUrl ffprobe -> %O`, error)
			})) as FFProbe
			if (!probe) continue

			let videos = probe.streams.filter(({ codec_type, tags }) => {
				if (codec_type != 'video') return false
				if (!tags || !tags.language) return true
				return tags.language.startsWith('en') || tags.language.startsWith('un')
			})
			if (videos.length == 0) {
				console.warn(`getStreamUrl probe !videos ->`, torrent.name)
				next = true
				continue
			}
			if (_.size(codecs) > 0 && !codecs.find(v => v.includes(videos[0].codec_name))) {
				console.warn(`getStreamUrl probe !codecs ->`, torrent.name, videos[0].codec_name)
				next = true
				continue
			}

			let audios = probe.streams.filter(({ codec_type, tags }) => {
				if (codec_type != 'audio') return false
				if (!tags || !tags.language) return true
				return tags.language.startsWith('en') || tags.language.startsWith('un')
			})
			if (audios.length == 0) {
				console.warn(`getStreamUrl probe !audios ->`, torrent.name)
				next = true
				continue
			}
			if (!audios.find(v => v.channels <= channels)) {
				console.warn(`getStreamUrl probe !channels ->`, torrent.name, audios[0].channels)
				next = true
				continue
			}

			return stream
		}
	}
}

export type Debrids = keyof typeof debrids
