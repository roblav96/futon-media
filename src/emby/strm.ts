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
import db from '@/adapters/db'

async function listen() {
	await fastify.listen(emby.STRM_PORT)
}
process.nextTick(() => listen().catch(error => console.error(`fastify listen -> %O`, error)))

const fastify = Fastify({ querystringParser: query => qs.parse(query) })

fastify.server.headersTimeout = 30000
fastify.server.keepAliveTimeout = 15000
fastify.server.timeout = 60000

// fastify.setErrorHandler((error, request, reply) => {
// 	console.error(`fastify -> %O`, error)
// 	return reply.redirect('/dev/null')
// })

const emitter = new Emitter<string, string>()

async function getDebridStream({ e, s, slug, traktId, type }: emby.StrmQuery) {
	let { Quality, Channels, Codecs } = (await emby.sessions.get()).find(v => !v.IsStreaming)
	console.log(`getDebridStream '${slug}' ->`, Quality, Channels, Codecs.video)
	// console.log(`Session ->`, Session)

	// console.log(`Bitrate ->`, `${utils.fromBytes(Session.Bitrate, 0)}/s`)
	// await utils.pTimeout(10000)
	// throw new Error(`DEV`)

	let full = (await trakt.client.get(`/${type}s/${traktId}`)) as trakt.Full
	let item = new media.Item({ type, [type]: full })
	if (type == 'show') {
		let seasons = (await trakt.client.get(`/${type}s/${traktId}/seasons`)) as trakt.Season[]
		let season = seasons.find(v => v.number == s)
		item.use({ type: 'season', season })
		let episode = await trakt.client.get(`/${type}s/${traktId}/seasons/${s}/episodes/${e}`)
		item.use({ type: 'episode', episode })
	}

	let torrents = await scraper.scrapeAll(item)
	torrents.sort((a, b) => b.bytes - a.bytes)
	if (type == 'show') {
		torrents.sort((a, b) => {
			let asize = a.packs ? a.bytes / (item.S.e * a.packs) : a.bytes
			let bsize = b.packs ? b.bytes / (item.S.e * b.packs) : b.bytes
			return bsize - asize
		})
	}
	// console.log(`scrapeAll torrents ->`, torrents.map(v => v.json))

	if (!process.DEVELOPMENT) {
		// let index = torrents.findIndex(v => v.cached.length > 0)
		let index = torrents.findIndex(v => v.cached.includes('realdebrid'))
		let downloads = torrents.slice(0, _.clamp(index, 0, 5))
		emitter.once(traktId, () =>
			debrids.download(downloads, item).catch(error => {
				console.error(`debrids.download ${item.title} -> %O`, error)
			})
		)
	}

	torrents = torrents.filter(v => v.cached.length > 0)
	if (torrents.length == 0) throw new Error(`!torrents`)

	if (Quality == '1080p') {
		torrents = torrents.filter(({ name }) => {
			name = name.toLowerCase()
			return !(name.includes('4k') || name.includes('2160p'))
		})
	}
	if (Channels <= 2) {
		torrents.sort((a, b) => b.seeders - a.seeders)
	}

	let stream = await debrids.getStream(torrents, item, Codecs.video, Channels)
	if (!stream) throw new Error(`!stream`)
	console.log(`getDebridStream '${slug}' ->`, stream)
	return stream
}

fastify.get('/strm', async (request, reply) => {
	let query = _.mapValues(request.query, (v, k) =>
		utils.isNumeric(v) ? _.parseInt(v) : v
	) as emby.StrmQuery
	query.traktId = query.traktId.toString()
	let { e, s, slug, traktId, type } = query
	console.warn(`fastify strm '${slug}' ->`, query)

	// console.time(`Session`)
	// let Session = (await emby.sessions.get()).find(v => !v.IsStreaming)
	// console.timeEnd(`Session`)

	let rkey = `strm:${traktId}`
	type == 'show' && (rkey += `:s${utils.zeroSlug(s)}e${utils.zeroSlug(e)}`)

	let stream = await db.get(rkey)
	if (!stream) {
		if (!emitter.eventNames().includes(traktId)) {
			getDebridStream(query).then(
				async stream => {
					await db.put(rkey, stream, utils.duration(1, 'day'))
					emitter.emit(traktId, stream)
				},
				async error => {
					console.error(`getDebridStream '${slug}' -> %O`, error)
					await db.put(rkey, '/dev/null', utils.duration(1, 'minute'))
					emitter.emit(traktId, '/dev/null')
				}
			)
		}
		stream = await emitter.toPromise(traktId)
	}

	// console.log(`redirect '${slug}' ->`, stream)
	reply.redirect(stream)
})

// const rxItem = emby.rxHttp.pipe(
// 	Rx.Op.filter(({ query }) => !!query.ItemId && !!query.UserId),
// 	Rx.Op.map(({ query }) => ({ ItemId: query.ItemId, UserId: query.UserId })),
// 	Rx.Op.distinctUntilChanged((a, b) => JSON.stringify(a) == JSON.stringify(b))
// )
// rxItem.subscribe(({ ItemId, UserId }) => {
// 	console.log(`rxItem ->`, ItemId, UserId)
// })

// async function getDebridSession() {
// 	let UserId = await emby.rxPlaybackUserId.pipe(Rx.Op.take(1)).toPromise()
// 	console.log(`getSession rxPlaybackUserId ->`, UserId)
// 	let Session = await emby.sessions.fromUserId(UserId)
// 	console.log(`Session ->`, Session)
// 	return Session
// }

// emby.rxPlaybackIsFalse.subscribe(async ({ query }) => {
// 	let Session = await emby.sessions.admin()
// 	let { Item, item } = await Session.item(query.ItemId)
// 	console.log(`Item ->`, Item)
// 	let rkey = `strm:${item.traktId}`
// 	if (_.isFinite(Item.ParentIndexNumber) && _.isFinite(Item.IndexNumber)) {
// 		rkey += `:s${utils.zeroSlug(Item.ParentIndexNumber)}`
// 		rkey += `e${utils.zeroSlug(Item.IndexNumber)}`
// 	}
// 	console.warn(`redis.del ->`, rkey)
// 	await redis.del(rkey)
// })
