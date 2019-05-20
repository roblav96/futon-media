import * as _ from 'lodash'
import * as debrids from '@/debrids/debrids'
import * as emby from '@/emby/emby'
import * as Fastify from 'fastify'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as putio from '@/debrids/putio'
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
fastify.server.keepAliveTimeout = 25000
fastify.server.timeout = 60000

const emitter = new Emitter<string, string>()

async function getDebridStreamUrl({ e, s, slug, traktId, type }: emby.StrmQuery, rkey: string) {
	let Sessions = (await emby.sessions.get()).sort((a, b) => a.Age - b.Age)
	let Session = Sessions[0]
	let UserId = await db.get(`UserId:${traktId}`)
	if (UserId) Session = Sessions.find(v => v.UserId == UserId) || Session
	let { Quality, Channels, Codecs } = Session
	console.log(`getDebridStreamUrl '${slug}' ->`, Session.json)

	let skey = `${rkey}:${utils.hash([Quality, Channels, Codecs.video])}`
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

	if (!process.DEVELOPMENT) console.log(`all torrents ->`, torrents.length)
	else console.log(`all torrents ->`, torrents.length, torrents.map(v => v.json))

	torrents = torrents.filter(({ split }) => {
		if (split.includes('2160p') || split.includes('uhd') || split.includes('4k')) {
			if (Quality != 'UHD') return false
		}
		return true
	})

	if (Quality.includes('HD')) {
		let putios = torrents.filter(({ cached, seeders }) => {
			return seeders > 0 && cached.length == 0
		})
		putios = putios.slice(0, 10)
		let cached = await putio.Putio.cached(putios.map(v => v.magnet))
		cached.forEach(({ magnet }) => {
			let torrent = torrents.find(v => v.magnet == magnet)
			torrent.cached.push('putio')
			console.warn(`Putio cached ->`, torrent.json)
		})
	}

	torrents = torrents.filter(({ cached }) => cached.length > 0)
	if (torrents.length == 0) throw new Error(`torrents.length == 0`)

	if (Quality == 'SD' || Channels == 2) torrents.sort((a, b) => b.seeders - a.seeders)

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

	let title = slug
	if (type == 'show') title += ` s${utils.zeroSlug(s)}e${utils.zeroSlug(e)}`
	console.log(`/strm ->`, title)

	let rkey = `stream:${traktId}`
	if (type == 'show') rkey += `:s${utils.zeroSlug(s)}e${utils.zeroSlug(e)}`
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
