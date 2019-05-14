import * as _ from 'lodash'
import * as debrids from '@/debrids/debrids'
import * as emby from '@/emby/emby'
import * as Fastify from 'fastify'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as trakt from '@/adapters/trakt'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import db from '@/adapters/db'
import Emitter from '@/shims/emitter'
import exithook = require('exit-hook')

process.nextTick(() => {
	process.DEVELOPMENT && db.flush('stream:*')
	fastify.listen(emby.env.STRM_PORT).then(
		address => {
			console.info(`fastify address ->`, address)
			exithook(() => fastify.close())
		},
		error => console.error(`fastify listen -> %O`, error)
	)
})

const fastify = Fastify({ querystringParser: query => qs.parse(query) })

fastify.server.headersTimeout = 30000
fastify.server.keepAliveTimeout = 15000
fastify.server.timeout = 60000

const emitter = new Emitter<string, string>()

async function getDebridStreamUrl({ e, s, slug, traktId, type }: emby.StrmQuery, rkey: string) {
	let Sessions = (await emby.sessions.get()).sort((a, b) => a.Age - b.Age)
	let Session = Sessions[0]
	let UserId = await db.get(`UserId:${traktId}`)
	if (UserId) {
		console.info(`db.get UserId ->`, UserId)
		Session = Sessions.find(v => v.UserId == UserId)
	}
	let { Quality, Channels, Codecs } = Session
	console.log(`getDebridStreamUrl '${slug}' ->`, Session.json)

	let skey = `${rkey}:${utils.hash([Quality, Channels, Codecs.video])}`
	console.log(`skey ->`, skey)
	let streamUrl = await db.get(skey)
	if (streamUrl) {
		console.log(`streamUrl '${slug}' ->`, streamUrl)
		return streamUrl
	}

	let full = (await trakt.client.get(`/${type}s/${traktId}`)) as trakt.Full
	let item = new media.Item({ type, [type]: full })
	if (type == 'show') {
		let seasons = (await trakt.client.get(`/${type}s/${traktId}/seasons`)) as trakt.Season[]
		let season = seasons.find(v => v.number == s)
		item.use({ type: 'season', season })
		let episode = await trakt.client.get(`/${type}s/${traktId}/seasons/${s}/episodes/${e}`)
		item.use({ type: 'episode', episode })
	}
	// process.DEVELOPMENT && console.log(`item ->`, item)

	let torrents = await scraper.scrapeAll(item)
	torrents.sort((a, b) => b.bytes - a.bytes)
	if (type == 'show') {
		torrents.sort((a, b) => {
			let asize = a.packs ? a.bytes / (item.S.e * a.packs) : a.bytes
			let bsize = b.packs ? b.bytes / (item.S.e * b.packs) : b.bytes
			return bsize - asize
		})
	}
	if (!process.DEVELOPMENT) console.log(`all torrents ->`, torrents.length)
	else console.log(`all torrents ->`, torrents.length, torrents.map(v => v.json))

	torrents = torrents.filter(v => {
		let split = utils.toSlug(v.name, { toName: true, lowercase: true }).split(' ')
		split.includes('720p') && (v.seeders = _.ceil(v.seeders / 10))
		if (split.includes('2160p') || split.includes('4k')) {
			if (Quality != '2160p') return false
			if (split.includes('sdr')) {
				if (split.includes('8bit') || split.includes('10bit')) return false
			}
		}
		return v.cached.length > 0
		// if (Quality == '2160p' && Channels > 2) {
		// 	v.cached.length == 0 && v.cached.push('putio')
		// 	return v.seeders > 0
		// }
	})
	if (Channels <= 2) torrents.sort((a, b) => b.seeders - a.seeders)

	if (torrents.length == 0) throw new Error(`torrents.length == 0`)
	if (!process.DEVELOPMENT) console.log(`torrents ->`, torrents.length)
	else console.log(`torrents ->`, torrents.length, torrents.map(v => v.json))

	streamUrl = await debrids.getStreamUrl(torrents, item, Channels, Codecs.video)
	if (!streamUrl) throw new Error(`getDebridStreamUrl !streamUrl -> '${slug}'`)
	await db.put(skey, streamUrl, utils.duration(1, 'day'))

	console.log(`👍 streamUrl '${slug}' ->`, streamUrl)
	return streamUrl
}

fastify.get('/strm', async (request, reply) => {
	if (_.size(request.query) == 0) return reply.redirect('/dev/null')
	let query = _.mapValues(request.query, (v, k: keyof emby.StrmQuery) =>
		utils.isNumeric(v) && k != 'traktId' ? _.parseInt(v) : v
	) as emby.StrmQuery
	let { e, s, slug, traktId, type } = query
	console.log(`fastify strm ->`, slug)

	let rkey = `stream:${traktId}`
	console.log(`rkey ->`, rkey)
	type == 'show' && (rkey += `:s${utils.zeroSlug(s)}e${utils.zeroSlug(e)}`)
	let stream = await db.get(rkey)
	if (!stream) {
		if (!emitter.eventNames().includes(traktId)) {
			getDebridStreamUrl(query, rkey).then(
				async stream => {
					await db.put(rkey, stream, utils.duration(1, 'minute'))
					emitter.emit(traktId, stream)
				},
				async error => {
					console.error(`getDebridStreamUrl '${slug}' -> %O`, error)
					await db.put(rkey, '/dev/null', utils.duration(1, 'minute'))
					emitter.emit(traktId, '/dev/null')
				}
			)
		}
		stream = await emitter.toPromise(traktId)
	}

	reply.redirect(stream)
})
