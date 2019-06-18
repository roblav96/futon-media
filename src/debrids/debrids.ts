import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrid from '@/debrids/debrid'
import * as ffprobe from '@/adapters/ffprobe'
import * as filters from '@/scrapers/filters'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as pQueue from 'p-queue'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'
// import { Offcloud } from '@/debrids/offcloud'
import { Premiumize } from '@/debrids/premiumize'
import { RealDebrid } from '@/debrids/realdebrid'

export const debrids = { realdebrid: RealDebrid, premiumize: Premiumize /** offcloud: Offcloud */ }

export async function cached(hashes: string[]) {
	let entries = Object.entries({
		realdebrid: RealDebrid,
		premiumize: Premiumize,
		// offcloud: Offcloud,
	})
	let resolved = await Promise.all(entries.map(([k, v]) => v.cached(hashes)))
	return hashes.map((v, index) => {
		return entries.map(([key], i) => resolved[i][index] && key).filter(Boolean)
	}) as Debrids[][]
}

let queue = new pQueue({ concurrency: 1 })
export function download(torrents: torrent.Torrent[]) {
	return queue.add(async () => {
		for (let torrent of torrents) {
			console.log(`download torrent ->`, torrent.short)
			let success = await RealDebrid.download(torrent.magnet).catch(async error => {
				console.error(`RealDebrid download '${torrent.short}' -> %O`, error)
				if (!torrent.cached.includes('premiumize')) {
					await Premiumize.download(torrent.magnet)
				}
				return false
			})
			if (success) {
				console.log(`👍 download success ->`, torrent.short)
				return
			}
		}
	})
}

export async function getStreamUrl(
	torrents: torrent.Torrent[],
	item: media.Item,
	channels: number,
	codecs: { audio: string[]; video: string[] }
) {
	for (let torrent of torrents) {
		let next = false
		for (let cached of torrent.cached) {
			if (next) continue
			console.info(`getStreamUrl '${cached}' torrent ->`, torrent.json)
			let debrid = new debrids[cached]().use(torrent.magnet)

			let files = (await debrid.getFiles().catch(error => {
				console.error(`getFiles -> %O`, error)
			})) as debrid.File[]
			if (!files) {
				console.warn(`!files ->`, torrent.short)
				continue
			}
			files = files.filter(v => !v.path.toLowerCase().includes('rarbg.com.mp4'))
			if (files.length == 0) {
				console.warn(`files.length == 0 ->`, torrent.short)
				next = true
				continue
			}

			console.log(`files ->`, files)
			let file = files.find(v => {
				let torrent = { name: utils.toSlug(v.name), packs: 0 } as torrent.Torrent
				return filters.torrents(torrent, item) && torrent.packs == 0
			})
			if (!file) {
				console.warn(`!file ->`, torrent.short, files)
				continue
			}
			console.log(`file ->`, file)

			let stream = (await debrid.streamUrl(file).catch(error => {
				console.error(`debrid.streamUrl -> %O`, error)
			})) as string
			if (!stream) {
				console.warn(`!stream ->`, torrent.short)
				continue
			}
			if (!utils.isVideo(stream)) {
				console.warn(`!isVideo stream ->`, torrent.short)
				continue
			}
			if (stream.startsWith('http:')) stream = stream.replace('http:', 'https:')

			console.log(`probe stream ->`, stream)
			let probe = (await ffprobe
				.probe(stream, { format: true, streams: true })
				.catch(error => console.error(`ffprobe '${stream}' -> %O`, error))) as ffprobe.Probe
			if (!probe) {
				next = true
				continue
			}

			console.log(`probe format ->`, ffprobe.json(probe.format))
			probe.streams = probe.streams.filter(({ codec_type }) =>
				['video', 'audio'].includes(codec_type)
			)

			let videos = probe.streams.filter(({ codec_name, codec_type, tags }) => {
				if (codec_type != 'video') return false
				if (codec_name == 'mjpeg') return false
				if (!tags || !tags.language) return true
				return tags.language.startsWith('en') || tags.language.startsWith('un')
			})
			if (videos.length == 0) {
				console.warn(`probe videos.length == 0 ->`, torrent.short)
				next = true
				continue
			}
			let vkeys = ['codec_long_name', 'codec_name', 'profile']
			console.log(`probe videos ->`, videos.map(v => _.pick(v, vkeys)))
			if (_.size(codecs.video) > 0 && !codecs.video.includes(videos[0].codec_name)) {
				console.warn(`probe !codecs.video ->`, torrent.short, videos[0].codec_name)
				next = true
				continue
			}

			let audios = probe.streams.filter(({ codec_type, tags }) => {
				if (codec_type != 'audio') return false
				if (!tags) return true
				if (tags.title && utils.includes(tags.title, 'commentary')) return false
				if (!tags.language) return true
				return tags.language.startsWith('en') || tags.language.startsWith('un')
			})
			if (audios.length == 0) {
				console.warn(`probe audios.length == 0 ->`, torrent.short)
				next = true
				continue
			}
			let akeys = ['channel_layout', 'channels', 'codec_long_name', 'codec_name', 'profile']
			console.log(`probe audios ->`, audios.map(v => _.pick(v, akeys)))
			if (!audios.find(v => v.channels <= channels)) {
				console.warn(`probe !channels ->`, torrent.short, audios.map(v => v.channels))
				next = true
				continue
			}
			if (
				_.size(codecs.audio) > 0 &&
				!audios.find(v => codecs.audio.includes(v.codec_name))
			) {
				console.warn(`probe !codecs.audio ->`, torrent.short, audios.map(v => v.codec_name))
				next = true
				continue
			}

			return stream
		}
	}
}

export type Debrids = keyof typeof debrids
