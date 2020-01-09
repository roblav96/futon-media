import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrid from '@/debrids/debrid'
import * as ffprobe from '@/adapters/ffprobe'
import * as filters from '@/scrapers/filters'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as utils from '@/utils/utils'
import pQueue from 'p-queue'
import { Premiumize } from '@/debrids/premiumize'
import { RealDebrid } from '@/debrids/realdebrid'
import { Torrent } from '@/scrapers/torrent'

export const debrids = {
	premiumize: Premiumize,
	realdebrid: RealDebrid,
}

export async function cached(hashes: string[]) {
	let entries = Object.entries(debrids)
	let resolved = await Promise.all(entries.map(([k, v]) => v.cached(hashes)))
	return hashes.map((v, index) => {
		return entries.map(([key], i) => resolved[i][index] && key).filter(Boolean)
	}) as Debrids[][]
}

let pDownloadQueue = new pQueue({ concurrency: 1 })
export async function download(torrents: Torrent[], item: media.Item) {
	if (!(await RealDebrid.hasActiveCount())) {
		return console.warn(`download RealDebrid.hasActiveCount == false`)
	}

	torrents = torrents.filter(v => {
		if (v.cached.length > 0) return true
		// console.log(`boosts '${utils.fromBytes(v.boosts(item.S.e).bytes)}' ->`, v.short())
		if (v.boosts.bytes < utils.toBytes(`${item.gigs} GB`)) return false
		return v.seeders * v.providers.length >= 3
	})
	console.log(
		`download torrents '${item.strm}' ->`,
		torrents.map(v => v.json()),
		torrents.length,
	)

	if (torrents.length == 0) return console.warn(`download torrents ->`, 'torrents.length == 0')

	if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

	return pDownloadQueue.add(async () => {
		for (let torrent of torrents) {
			console.log(`download torrent ->`, torrent.short())
			let success = torrent.cached.length > 0
			try {
				if (!success) success = await RealDebrid.download(torrent.magnet)
				if (success) return console.log(`👍 download torrent success ->`, torrent.short())
			} catch (error) {
				console.error(`download RealDebrid '${torrent.short()}' -> %O`, error.message)
				if (!torrent.cached.includes('premiumize')) {
					// await Premiumize.download(torrent.magnet)
				}
			}
		}
	})
}

export async function getStream(
	torrents: Torrent[],
	item: media.Item,
	AudioChannels: number,
	AudioCodecs: string[],
	VideoCodecs: string[],
) {
	for (let torrent of torrents) {
		let next = false
		for (let cached of torrent.cached) {
			if (next) continue
			if (cached == 'realdebrid') continue
			console.info(`getStream '${cached}' torrent ->`, torrent.json())
			let debrid = new debrids[cached]().use(torrent.magnet)

			let files = (await debrid.getFiles().catch(error => {
				console.error(`getFiles -> %O`, error)
			})) as debrid.File[]
			if (!files) {
				console.warn(`!files ->`, torrent.short())
				continue
			}

			_.remove(files, ({ path }) => {
				let slug = ` ${utils.slugify(path)} `
				return ['rarbg com mp4', 'extras', 'sample'].find(v => slug.includes(` ${v} `))
			})

			if (files.length == 0) {
				console.warn(`files.length == 0 ->`, torrent.short())
				next = true
				continue
			}

			let file = files.find(v =>
				filters.torrents(
					new Torrent(Object.assign({}, torrent.result, { name: v.path }), item),
					item,
				),
			)
			if (!file) {
				console.warn(`!file ->`, torrent.short(), files)
				continue
			}
			console.log(`file ->`, file)

			let stream = (await debrid.streamUrl(file).catch(error => {
				console.error(`debrid.streamUrl -> %O`, error)
			})) as string
			if (!stream) {
				console.warn(`!stream ->`, torrent.short())
				continue
			}
			if (!utils.isVideo(stream)) {
				console.warn(`!isVideo stream ->`, torrent.short())
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
				['video', 'audio'].includes(codec_type),
			)

			let videos = probe.streams.filter(({ codec_name, codec_type, tags }) => {
				if (codec_type != 'video') return false
				if (codec_name == 'mjpeg') return false
				if (!tags || !tags.language) return true
				return tags.language.startsWith('en') || tags.language.startsWith('un')
			})
			if (videos.length == 0) {
				console.warn(`probe videos.length == 0 ->`, torrent.short())
				next = true
				continue
			}
			let vkeys = ['codec_long_name', 'codec_name', 'profile']
			console.log(
				`probe videos ->`,
				videos.map(v => _.pick(v, vkeys)),
			)
			if (_.size(VideoCodecs) > 0 && !VideoCodecs.includes(videos[0].codec_name)) {
				console.warn(`probe !VideoCodecs ->`, torrent.short(), videos[0].codec_name)
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
				console.warn(`probe audios.length == 0 ->`, torrent.short())
				next = true
				continue
			}
			let akeys = ['channel_layout', 'channels', 'codec_long_name', 'codec_name', 'profile']
			console.log(
				`probe audios ->`,
				audios.map(v => _.pick(v, akeys)),
			)
			if (!audios.find(v => v.channels <= AudioChannels)) {
				console.warn(
					`probe !AudioChannels ->`,
					torrent.short(),
					audios.map(v => v.channels),
				)
				next = true
				continue
			}
			if (_.size(AudioCodecs) > 0 && !audios.find(v => AudioCodecs.includes(v.codec_name))) {
				console.warn(
					`probe !AudioCodecs ->`,
					torrent.short(),
					audios.map(v => v.codec_name),
				)
				next = true
				continue
			}

			return stream
		}
	}
}

export type Debrids = keyof typeof debrids
