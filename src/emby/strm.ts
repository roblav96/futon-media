import * as _ from 'lodash'
import * as debrids from '@/debrids/debrids'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
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

	let Session = (await emby.Session.get()).find(v => v.ItemPath == Item.Path)
	let PlaybackInfo: emby.PlaybackInfo
	while (!PlaybackInfo) {
		PlaybackInfo = await emby.PlaybackInfo.get(Item.Id, Session && Session.UserId)
		if (!PlaybackInfo) await utils.pTimeout(300)
	}
	if (!Session) Session = (await emby.Session.get()).find(v => v.UserId == PlaybackInfo.UserId)
	console.warn(`[${Session.short}] getDebridStream '${title}' ->`, PlaybackInfo.json)

	if (process.DEVELOPMENT) {
		// throw new Error(`DEVELOPMENT`)
		// return 'https://imaginaryblueogre-sto.energycdn.com/dl/aAOuiBl5umEyeFVtvoa4kA/1573518735/675000842/5d8e693b9bfb56.35804272/Toy.Story.4.2019.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-FGT.mkv'
		// return '0.0.0.0'
		// return 'https://battlefuryscepter-sto.energycdn.com/dl/Eof6rPXcoUu5vGH0vjWnUQ/1572224225/675000842/5bd4d143ada4d8.47303017/hd1080-walle.mkv'
		// return 'https://whitetreefairy-sto.energycdn.com/dl/2bQ74BXOQcwsenIZWFJSWg/1572156133/675000842/5d3894d4c0d876.18082955/How%20the%20Universe%20Works%20S02E04%201080p%20WEB-DL%20DD%2B%202.0%20x264-TrollHD.mkv'
		// return 'https://lazycarefulsailor-sto.energycdn.com/dl/aiGuRJQkn0AVJ2bfVAItyQ/1572142690/675000842/5da9d83ec2a9c6.33536050/Starsky.And.Hutch.2004.1080p.BluRay.x264.DTS-FGT.mkv'
		// return 'https://phantasmagoricfairytale-sto.energycdn.com/dl/uat0AxAx0BEAddz2zeRVyg/1572129772/675000842/5da6353eb18ad8.55901578/The.Lion.King.2019.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1-FGT.mkv'
	}

	let { Quality, AudioChannels, AudioCodecs, VideoCodecs } = PlaybackInfo
	let skey = `${Item.Id}:${utils.hash([Quality, AudioChannels, AudioCodecs, VideoCodecs])}`
	let stream = await db.get(skey)
	if (stream && stream != 'null') return stream

	let item = await emby.library.item(Item)
	let torrents = await scraper.scrapeAll(item, PlaybackInfo.Quality != 'SD')
	let cacheds = torrents.filter(v => v.cached.length > 0)
	console.log(
		`strm cacheds '${title}' ->`,
		cacheds.map(v => v.short),
		cacheds.length,
	)

	if (process.DEVELOPMENT) throw new Error(`DEVELOPMENT`)

	if (cacheds.length == 0) {
		debrids.download(torrents, item)
		await db.put(skey, 'null', utils.duration(1, 'hour'))
		throw new Error(`cacheds.length == 0`)
	}

	stream = await debrids.getStream(cacheds, item, AudioChannels, AudioCodecs, VideoCodecs)
	if (!stream) {
		debrids.download(torrents, item)
		await db.put(skey, 'null', utils.duration(1, 'hour'))
		throw new Error(`debrids.getStream !stream -> '${title}'`)
	}

	await db.put(skey, stream, utils.duration(1, 'day'))
	console.log(Date.now() - t, `👍 stream '${title}' ->`, stream)
	return stream
}

fastify.get('/strm', async (request, reply) => {
	if (_.isEmpty(request.query)) return reply.code(404).send(Buffer.from(''))

	// console.warn(`reply.redirect`)
	// return reply.redirect(
	// 	`https://electrifiedcandycane-sto.energycdn.com/dl/6wtiozo4fccgaVc_vQqkRQ/1576057813/675000842/5de734bf153e33.60144700/the.daily.show.2019.12.03.ta-nehisi.coates.extended.1080p.web.x264-tbs.mkv`,
	// )

	let Query = _.mapValues(request.query, v =>
		utils.isNumeric(v) ? _.parseInt(v) : v,
	) as emby.StrmQuery
	let Item = (await emby.library.Items({ Path: emby.library.toStrmPath(Query, true) }))[0]
	let title = emby.library.toTitle(Item)
	console.log(`/strm ->`, `'${title}'`)

	let stream = (await db.get(Item.Id)) as string
	if (!_.isString(stream)) {
		if (!emitter.eventNames().includes(Item.Id)) {
			try {
				stream = await getDebridStream(Item)
			} catch (error) {
				console.error(`/strm '${title}' -> %O`, error.message)
				stream = 'null'
			}
			await db.put(Item.Id, stream, utils.duration(1, 'minute'))
			emitter.emit(Item.Id, stream)
		} else {
			stream = await emitter.toPromise(Item.Id)
		}
	}

	if (!stream || stream == 'null') return reply.code(404).send(Buffer.from(''))
	reply.redirect(stream)
})
