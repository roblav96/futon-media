import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as emby from '@/emby/emby'
import * as Fastify from 'fastify'
import * as media from '@/media/media'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as trakt from '@/adapters/trakt'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import Emitter from '@/shims/emitter'
import ffprobe from '@/adapters/ffprobe'
import redis from '@/adapters/redis'

async function listen() {
	// ffprobe(
	// 	`https://miriam.makefast.co/dl/SewyeARRQy52TW6yrcM3YQ/1556551274/675000842/5ba4f74d335200.99795817/Sicario.Day.Of.The.Soldado.2018.1080p.BluRay.x264-%5BYTS.AM%5D.mp4`
	// )
	await fastify.listen(emby.STRM_PORT)
}
process.nextTick(() => listen().catch(error => console.error(`fastify listen -> %O`, error)))

const fastify = Fastify({ querystringParser: query => qs.parse(query) })

fastify.server.headersTimeout = 30000
fastify.server.keepAliveTimeout = 15000
fastify.server.timeout = 60000

const emitter = new Emitter<string, string>()

async function getDebridStreamUrl({ e, quality, s, title, traktId, type }: StrmQuery) {
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

	let torrents4k = JSON.parse(JSON.stringify(torrents))
	console.log(`torrents4k ->`, torrents4k)
	emitter.once(traktId, () =>
		debrids.download(torrents4k.map(v => new torrent.Torrent(v)), item).catch(error => {
			console.error(`debrids.download ${item.title} -> %O`, error)
		})
	)

	torrents = torrents.filter(v => v.cached.length > 0)
	if (torrents.length == 0) throw new Error(`!torrents`)

	if (quality != '4K') {
		torrents.sort((a, b) => b.seeders - a.seeders)
	}

	let stream = await debrids.getStreamUrl(torrents, item)
	if (!stream) throw new Error(`!stream`)
	console.warn(`${title} ${quality} stream ->`, stream)
	return stream
}

fastify.get('/strm', async (request, reply) => {
	let query = _.mapValues(request.query, (v, k) => {
		return !isNaN(v) && k != 'traktId' ? _.parseInt(v) : v
	}) as StrmQuery
	let { e, quality, s, title, traktId, type } = query
	console.log(`${title} ${quality} query ->`, query)

	let Session = (await emby.sessions.get())[0]

	let rkey = `strm:${traktId}`
	type == 'show' && (rkey += `:s${utils.zeroSlug(s)}e${utils.zeroSlug(e)}`)
	rkey += `:${quality}`

	let link = await redis.get(rkey)
	if (!link) {
		if (!emitter.eventNames().includes(traktId)) {
			let seconds = utils.duration(1, process.DEVELOPMENT ? 'minute' : 'hour') / 1000
			getDebridStreamUrl(query).then(
				async link => {
					await redis.setex(rkey, seconds, link)
					emitter.emit(traktId, link)
				},
				async error => {
					console.error(`${title} ${quality} getDebridStreamUrl -> %O`, error)
					await redis.setex(rkey, seconds, `/dev/null`)
					emitter.emit(traktId, `/dev/null`)
				}
			)
		}
		link = await emitter.toPromise(traktId)
	}

	if (quality == '4K' && Session.Capabilities.DeviceProfile) {
		reply.redirect(`/dev/null`)
		return
	}

	reply.redirect(link)
})

interface StrmQuery {
	e: number
	quality: emby.Quality
	s: number
	title: string
	traktId: string
	type: media.MainContentType
}
