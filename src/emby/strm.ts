import * as _ from 'lodash'
import * as debrids from '@/debrids/debrids'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as trakt from '@/adapters/trakt'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import Emitter from '@/utils/emitter'
import Fastify from '@/adapters/fastify'
import { Db } from '@/adapters/db'

const fastify = Fastify(process.env.EMBY_PROXY_PORT)
const emitter = new Emitter<string, string>()

const db = new Db(__filename)
process.nextTick(() => process.DEVELOPMENT && db.flush())

async function getDebridStream(Item: emby.Item) {
	let t = Date.now()
	let title = emby.library.toTitle(Item)

	let Sessions = await emby.Session.get()
	let Session = Sessions.find(v => v.ItemPath == Item.Path)
	if (!Session) Session = _.first(Sessions.filter(v => !v.ItemPath))
	let useragent = await emby.PlaybackInfo.useragent(Session.UserId, Item.Id)
	let PlaybackInfo = await emby.PlaybackInfo.get(useragent, Session.UserId, Item.Id)

	if (process.DEVELOPMENT) {
		// throw new Error(`DEVELOPMENT`)
		// return 'https://imaginaryblueogre-sto.energycdn.com/dl/aAOuiBl5umEyeFVtvoa4kA/1573518735/675000842/5d8e693b9bfb56.35804272/Toy.Story.4.2019.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv'
		// return '0.0.0.0'
		// return 'https://battlefuryscepter-sto.energycdn.com/dl/Eof6rPXcoUu5vGH0vjWnUQ/1572224225/675000842/5bd4d143ada4d8.47303017/hd1080-walle.mkv'
		// return 'https://whitetreefairy-sto.energycdn.com/dl/2bQ74BXOQcwsenIZWFJSWg/1572156133/675000842/5d3894d4c0d876.18082955/How%20the%20Universe%20Works%20S02E04%201080p%20WEB-DL%20DD%2B%202.0%20x264-TrollHD.mkv'
		// return 'https://lazycarefulsailor-sto.energycdn.com/dl/aiGuRJQkn0AVJ2bfVAItyQ/1572142690/675000842/5da9d83ec2a9c6.33536050/Starsky.And.Hutch.2004.1080p.BluRay.x264.DTS-FGT.mkv'
		// return 'https://phantasmagoricfairytale-sto.energycdn.com/dl/uat0AxAx0BEAddz2zeRVyg/1572129772/675000842/5da6353eb18ad8.55901578/The.Lion.King.2019.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1-FGT.mkv'
	}

	let isHD = PlaybackInfo.Quality != 'SD'
	let { Quality, AudioChannels, AudioCodecs, VideoCodecs } = PlaybackInfo
	let skey = `${Item.Id}:${utils.hash([Quality, AudioChannels, AudioCodecs, VideoCodecs])}`
	let stream = await db.get(skey)
	if (stream) return stream
	console.log(`[${Session.short}] getDebridStream '${title}' ->`, PlaybackInfo.json)

	let item = await emby.library.item(Item)
	let torrents = await scraper.scrapeAllQueue(item, isHD)
	let cacheds = torrents.filter(v => v.cached.length > 0)
	if (!isHD) {
		cacheds = _.orderBy(cacheds, v => v.cached.includes('premiumize'), ['desc'])
	}
	console.log(
		`strm cached torrents '${title}' ->`,
		cacheds.map(v => v.short()),
		cacheds.length,
	)

	// if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

	if (cacheds.length == 0) {
		debrids.downloadQueue(torrents, item)
		await db.put(skey, 'error', utils.duration(1, 'minute'))
		let error = new Error(
			`Instant cached stream not available for '${title}', downloading now, try again later`,
		)
		Session.Message(error)
		throw error
	}

	stream = await debrids.getStream(cacheds, item, AudioChannels, AudioCodecs, VideoCodecs, isHD)
	if (!stream) {
		debrids.downloadQueue(torrents, item)
		await db.put(skey, 'error', utils.duration(1, 'minute'))
		let error = new Error(
			`Compatible stream not available for '${title}' on device '${Session.DeviceName}', downloading now, try again later`,
		)
		Session.Message(error)
		throw error
	}

	// if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

	await db.put(skey, stream, utils.duration(1, 'day'))
	Session.Message(`👍 Success 🔶 ${decodeURIComponent(path.basename(stream))}`)
	console.log(Date.now() - t, `👍 stream '${title}' ->`, stream)
	return stream
}

fastify.get('/strm', async (request, reply) => {
	if (_.isEmpty(request.query)) return reply.code(404).send(Buffer.from(''))

	// console.warn(`reply.redirect`)
	// return reply.redirect(
	// 	'https://quinn.pm2.link/dl/vxgp18gP7yJR2NCHiH2aJA/1579659301/675000842/5dce4cc6253213.07477639/Star%20Wars%20The%20Clone%20Wars%2003x05%20Corruption.mkv',
	// 	// 'https://flyingspagetthimonster-sto.energycdn.com/dl/6Cw0dVlagZ0XsudlflMZOA/1579628677/675000842/5a45f3291adae2.06406138/Star.Wars.The.Clone.Wars.BluRay.1080p.x264.5.1.Judas.mp4',
	// 	// 'https://cuddlysnappywerewolf-sto.energycdn.com/dl/FTb4zDyoo8sn_UBy9uImCw/1579628672/675000842/5ce96f011dba82.75355021/Star.Wars.The.Clone.Wars.2008.1080p.BluRay.H264.AAC-RARBG.mp4',
	// )

	let { file, type } = request.query as emby.StrmQuery
	let Item = await emby.library.byPath(emby.library.getFolder(type) + file)
	let title = emby.library.toTitle(Item)
	console.log(`/strm ->`, `'${title}'`)

	let stream = (await db.get(Item.Id)) as string
	if (!_.isString(stream)) {
		if (!emitter.eventNames().includes(Item.Id)) {
			try {
				stream = await getDebridStream(Item)
			} catch (error) {
				console.error(`/strm '${title}' -> %O`, error)
				stream = 'error'
			}
			setTimeout(emby.library.reset, utils.duration(1, 'minute'), Item)
			await db.put(Item.Id, stream, utils.duration(1, 'minute'))
			emitter.emit(Item.Id, stream)
		} else {
			stream = await emitter.toPromise(Item.Id)
		}
	}

	if (!stream || stream == 'error') return reply.code(404).send(Buffer.from(''))
	reply.redirect(stream)
})
