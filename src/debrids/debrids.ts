import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrid from '@/debrids/debrid'
import * as ffprobe from '@/adapters/ffprobe'
import * as filters from '@/scrapers/filters'
import * as guessit from '@/adapters/guessit'
import * as media from '@/media/media'
import * as parser from '@/scrapers/parser'
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
export let downloadQueue = function (...args) {
	return pDownloadQueue.add(() => download(...args))
} as typeof download
async function download(torrents: Torrent[], item: media.Item) {
	if (!(await RealDebrid.hasActiveCount())) {
		return console.warn(`download RealDebrid.hasActiveCount == false`)
	}

	torrents = torrents.filter((v) => {
		if (v.cached.length > 0) return true
		if (v.providers.length == 1) return false
		return v.providers.length * v.seeders >= 3
		// return v.providers.length * v.boosts().seeders >= 3
	})
	console.log(
		`download torrents '${item.strm}' ->`,
		torrents.map((v) => v.short()),
		torrents.length,
	)

	for (let torrent of torrents) {
		console.log(`download torrent ->`, torrent.short(), [torrent.minmagnet])
		if (
			torrent.cached.includes('realdebrid') ||
			(await new RealDebrid(torrent.magnet).download())
		) {
			if (
				torrent.cached.includes('premiumize') ||
				(await new Premiumize(torrent.magnet).download())
			) {
				return console.log(`👍 download torrents success ->`, torrent.short())
			}
		}
	}
}

export async function getStream(
	torrents: Torrent[],
	item: media.Item,
	AudioChannels: number,
	AudioCodecs: string[],
	VideoCodecs: string[],
	isHD: boolean,
) {
	for (let torrent of torrents) {
		let next = false
		for (let cached of torrent.cached) {
			if (next) continue
			// if (!isHD && cached == 'realdebrid') continue
			console.info(`getStream '${cached}' torrent ->`, torrent.json())
			let debrid = new debrids[cached](torrent.magnet)

			let files = (await debrid.getFiles().catch((error) => {
				console.error(`getFiles -> %O`, error)
			})) as debrid.File[]
			files.forEach((file) => {
				file.parsed = new parser.Parser(file.path, true)
				file.levens = _.sum(item.aliases.map((v) => utils.levens(file.path, v)))
			})
			files = _.sortBy(files, 'levens')

			let removed = _.remove(files, (file) => {
				if (!utils.isVideo(file.path)) {
					file.parsed.filter = `⛔ !isVideo`
					return true
				}

				let bytes = file.bytes
				if (file.parsed.episodes.length > 1) {
					bytes = bytes / file.parsed.episodes.length
				}
				if (filters.runtime(file.parsed, item.runtime, bytes) == false) {
					return true
				}

				// if (filters.aliases(file.parsed, item.aliases) == false) {
				// 	return true
				// }
				// if (filters.collisions(file.parsed, item.collisions) == false) {
				// 	return true
				// }

				if (item.movie) {
					file.parsed.filter = `✅ return`
					return false
				}

				if (item.show) {
					if (item.isDaily && filters.aired(file.parsed, item.ep.a) == true) {
						return false
					}
					if (item.ep.t && filters.eptitle(file.parsed, item.ep.ts) == true) {
						return false
					}
					if (!_.isEmpty(file.parsed.seasons) && !_.isEmpty(file.parsed.episodes)) {
						return filters.s00e00(file.parsed, item.se.n, item.ep.n) == false
					}
					if (!_.isEmpty(torrent.episodes)) {
						return filters.e00(file.parsed, item.ep.n) == false
					}
					if (!_.isEmpty(torrent.seasons)) {
						return filters.s00(file.parsed, item.se.n) == false
					}
					file.parsed.filter = `⛔ return`
					return true
				}
			})

			if (process.DEVELOPMENT) {
				// console.log(
				// 	`removed ->`,
				// 	removed.map(v => ({ ...v, parsed: v.parsed.json() })),
				// 	removed.length,
				// )
				console.log(
					`files ->`,
					files.map((v) => ({ ...v, parsed: v.parsed.json() })),
					files.length,
				)
			}

			if (_.isEmpty(files)) {
				console.warn(`!files ->`, torrent.short())
				continue
			}

			let file = _.first(files)
			console.log(`file ->`, { ...file, parsed: file.parsed.json() })
			let original = !!isHD && !!AudioCodecs.find((v) => ['dts', 'truehd'].includes(v))
			let stream = (await debrid.streamUrl(file, original).catch((error) => {
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
			let probe = (await ffprobe.probe(stream).catch((error) => {
				console.error(`ffprobe '${stream}' -> %O`, error)
			})) as ffprobe.Probe
			if (!probe) {
				next = true
				continue
			}

			// console.log(`probe format ->`, ffprobe.json(probe.format))
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
				videos.map((v) => _.pick(v, vkeys)),
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
				audios.map((v) => _.pick(v, akeys)),
			)
			if (
				_.size(AudioCodecs) > 0 &&
				!audios.find((v) => AudioCodecs.includes(v.codec_name))
			) {
				console.warn(
					`probe !AudioCodecs ->`,
					torrent.short(),
					audios.map((v) => v.codec_name),
				)
				next = true
				continue
			}
			// if (!audios.find(v => v.channels <= AudioChannels)) {
			// 	console.warn(
			// 		`probe !AudioChannels ->`,
			// 		torrent.short(),
			// 		audios.map(v => v.channels),
			// 	)
			// 	next = true
			// 	continue
			// }

			return stream
		}
	}
}

export type Debrids = keyof typeof debrids
