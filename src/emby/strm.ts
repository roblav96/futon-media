import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as emby from '@/emby/emby'
import * as Fastify from 'fastify'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as trakt from '@/adapters/trakt'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import Emitter from '@/shims/emitter'
import redis from '@/adapters/redis'

async function listen() {
	await fastify.listen(emby.STRM_PORT)
}
process.nextTick(() => listen().catch(error => console.error(`fastify listen -> %O`, error)))

const fastify = Fastify({ querystringParser: query => qs.parse(query) })

fastify.server.headersTimeout = 30000
fastify.server.keepAliveTimeout = 15000
fastify.server.timeout = 60000

const emitter = new Emitter<string, string>()

async function getDebridTorrents({ e, s, title, traktId, type }: emby.StrmQuery) {
	let full = (await trakt.client.get(`/${type}s/${traktId}`)) as trakt.Full
	let item = new media.Item({ type, [type]: full })
	if (type == 'show') {
		let seasons = (await trakt.client.get(`/${type}s/${traktId}/seasons`)) as trakt.Season[]
		let season = seasons.find(v => v.number == s)
		item.use({ type: 'season', season })
		let episode = await trakt.client.get(`/${type}s/${traktId}/seasons/${s}/episodes/${e}`)
		item.use({ type: 'episode', episode })
	}
	// console.log(`item ->`, item)

	let torrents = await scraper.scrapeAll(item)
	torrents.sort((a, b) => b.bytes - a.bytes)
	if (type == 'show') {
		torrents.sort((a, b) => {
			let asize = a.packs ? a.bytes / (item.S.e * a.packs) : a.bytes
			let bsize = b.packs ? b.bytes / (item.S.e * b.packs) : b.bytes
			return bsize - asize
		})
	}
	// console.log(`scrapeAll torrents ->`, torrents.map(v => v.json()))

	let index = torrents.findIndex(v => v.cached.includes('realdebrid'))
	let downloads = torrents.slice(0, _.clamp(index, 0, 5))
	emitter.once(traktId, () =>
		debrids.download(downloads, item).catch(error => {
			console.error(`debrids.download ${item.title} -> %O`, error)
		})
	)

	return { item, torrents: torrents.filter(v => v.cached.length > 0) }
}

async function getDebridSession() {
	let UserId = await emby.rxPlaybackUserId.pipe(Rx.Op.take(1)).toPromise()
	console.log(`getSession rxPlaybackUserId ->`, UserId)
	return await emby.sessions.fromUserId(UserId)
}

async function getDebridStream(strmquery: emby.StrmQuery) {
	let [Session, { item, torrents }] = await Promise.all([
		getDebridSession(),
		getDebridTorrents(strmquery),
	])
	if (torrents.length == 0) throw new Error(`!torrents`)

	if (Session.quality != '4K') {
		torrents.sort((a, b) => b.seeders - a.seeders)
	}

	let stream = await debrids.getStream(torrents, item, Session.quality != '4K')
	if (!stream) throw new Error(`!stream`)
	console.warn(`stream ->`, strmquery.title, Session.quality, stream)
	return stream
}

emby.rxPlaybackIsFalse.subscribe(async ({ query }) => {
	let Session = await emby.sessions.fromUserId(query.UserId)
	let { Item, item } = await Session.Item(query.ItemId)
	let rkey = `strm:${item.traktId}`
	if (item.type) {
		rkey += `:s${utils.zeroSlug(Item.ParentIndexNumber)}`
		rkey += `e${utils.zeroSlug(Item.IndexNumber)}`
	}
	console.warn(`redis.del ->`, rkey)
	await redis.del(rkey)
})

fastify.get('/strm', async (request, reply) => {
	let strmquery = _.mapValues(request.query, (v, k) => {
		return !isNaN(v) && k != 'traktId' ? _.parseInt(v) : v
	}) as emby.StrmQuery
	let { e, s, title, traktId, type } = strmquery
	console.log(`fastify strm ->`, title)

	let rkey = `strm:${traktId}`
	type == 'show' && (rkey += `:s${utils.zeroSlug(s)}e${utils.zeroSlug(e)}`)

	let stream = await redis.get(rkey)
	if (!stream) {
		if (!emitter.eventNames().includes(traktId)) {
			getDebridStream(strmquery).then(
				async stream => {
					let seconds = utils.duration(1, 'day') / 1000
					await redis.setex(rkey, seconds, stream)
					emitter.emit(traktId, stream)
				},
				async error => {
					console.error(`getDebridStream ${title} -> %O`, error)
					let seconds = utils.duration(1, 'minute') / 1000
					await redis.setex(rkey, seconds, `/dev/null`)
					emitter.emit(traktId, `/dev/null`)
				}
			)
		}
		stream = await emitter.toPromise(traktId)
	}

	console.log(`redirect ->`, stream)
	reply.redirect(stream)
})
