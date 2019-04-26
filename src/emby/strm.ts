import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as emby from '@/emby/emby'
import * as Fastify from 'fastify'
import * as media from '@/media/media'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as scraper from '@/scrapers/scraper'
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

async function getDebridLink({ e, quality, s, title, traktId, type }: StrmQuery) {
	let full = (await trakt.client.get(`/${type}s/${traktId}`)) as trakt.Full
	let item = new media.Item({ type, [type]: full })
	if (type == 'show') {
		let seasons = (await trakt.client.get(`/${type}s/${traktId}/seasons`)) as trakt.Season[]
		let season = seasons.find(v => v.number == s)
		item.use({ type: 'season', season })
		let episode = await trakt.client.get(`/${type}s/${traktId}/seasons/${s}/episodes/${e}`)
		item.use({ type: 'episode', episode })
	}
	console.log(`item ->`, item)

	let torrents = await scraper.scrapeAll(item)
	torrents.sort((a, b) => b.bytes - a.bytes)
	if (type == 'show') {
		torrents.sort((a, b) => {
			let asize = a.packSize ? (a.bytes / item.S.e) * a.packSize : a.bytes
			let bsize = b.packSize ? (b.bytes / item.S.e) * b.packSize : b.bytes
			return bsize - asize
		})
	}
	console.log(`scrapeAll torrents ->`, torrents.map(v => v.toJSON()))

	torrents = torrents.filter(v => v.cached.includes('realdebrid'))
	if (torrents.length == 0) throw new Error(`!torrents`)

	if (quality != '4K') {
		torrents.sort((a, b) => b.seeders - a.seeders)
	}

	let link = await debrids.getLink(torrents, item)
	if (!link) throw new Error(`!link`)
	console.warn(`${title} ${quality} link ->`, link)
	return link
}

fastify.get('/strm', async (request, reply) => {
	let query = _.mapValues(request.query, (v, k) => {
		return !isNaN(v) && k != 'traktId' ? _.parseInt(v) : v
	}) as StrmQuery
	let { title, traktId, quality } = query
	console.log(`${title} ${quality} query ->`, query)

	let Session = (await emby.sessions.get())[0]

	let rkey = `strm:${traktId}:${quality}`
	let link = await redis.get(rkey)
	if (!link) {
		if (!emitter.eventNames().includes(traktId)) {
			getDebridLink(query).then(
				async link => {
					let seconds = utils.duration(1, process.DEVELOPMENT ? 'minute' : 'week') / 1000
					await redis.setex(rkey, seconds, link)
					emitter.emit(traktId, link)
				},
				async error => {
					console.error(`${title} ${quality} getDebridLink -> %O`, error)
					let seconds = utils.duration(1, process.DEVELOPMENT ? 'minute' : 'hour') / 1000
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

// const PriorityQueue = (new PQueue() as any)._queueClass as PQueue.QueueClassConstructor<
// 	PQueue.DefaultAddOptions & { id: string }
// >
// class QueueClass extends PriorityQueue {
// 	ids = [] as string[]
// }
// const queue = new PQueue({ queueClass: QueueClass })
