import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrid from '@/debrids/debrid'
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
	// emby.rxSession.subscribe(Session =>
	// 	console.log(`rxSession ->`, dayjs(Session.LastActivityDate).fromNow())
	// )
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

async function getDebridLink({ e, s, traktId, type }: StrmQuery) {
	let Session = (await emby.sessions.get())[0]

	let full = (await trakt.client.get(`/${type}s/${traktId}`)) as trakt.Full
	let item = new media.Item({ type, [type]: full })

	let torrents = await scraper.scrapeAll(item)
	torrents = torrents.filter(v => v.cached.includes('realdebrid'))
	if (torrents.length == 0) throw new Error(`!torrents`)

	let sortby = Session.Capabilities.DeviceProfile ? 'seeders' : 'bytes'
	torrents.sort((a, b) => b[sortby] - a[sortby])
	console.log(`torrents ->`, torrents.map(v => v.toJSON()))

	let link = await debrid.getLink(torrents, item)
	if (!link) throw new Error(`!link`)
	await redis.setex(`strm:${traktId}`, 60, link)
	return link
}

fastify.get('/strm', async (request, reply) => {
	let squery = _.mapValues(request.query, (v, k) => {
		return !isNaN(v) && k != 'traktId' ? _.parseInt(v) : v
	}) as StrmQuery
	console.log(`${squery.title} squery ->`, squery)

	let link = await redis.get(`strm:${squery.traktId}`)
	console.log(`link ->`, link)
	if (!link) {
		if (!emitter.eventNames().includes(squery.traktId)) {
			getDebridLink(squery).then(
				link => emitter.emit(squery.traktId, link),
				error => {
					console.error(`${squery.title} getDebridLink -> %O`, error)
					emitter.emit(squery.traktId, `/dev/null`)
				}
			)
		}
		link = await emitter.toPromise(squery.traktId)
	}
	console.warn(`${squery.title} link ->`, link)

	reply.redirect(link)
})

interface StrmQuery {
	e: number
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
