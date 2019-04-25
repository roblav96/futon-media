import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as Fastify from 'fastify'
import * as playback from '@/emby/playback'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as trakt from '@/adapters/trakt'
import * as media from '@/media/media'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import Emitter from '@/shims/emitter'
import redis from '@/adapters/redis'

export const fastify = Fastify({ querystringParser: query => qs.parse(query) })

fastify.server.headersTimeout = 30000
fastify.server.keepAliveTimeout = 15000
fastify.server.timeout = 60000

let emitter = new Emitter<string, string>()

fastify.get('/strm', async (request, reply) => {
	// console.log(`request ->`, request)
	let squery = _.mapValues(request.query, v => (!isNaN(v) && _.parseInt(v)) || v) as StrmQuery
	console.log(`squery ->`, squery)

	// let strm =

	let { url, query } = await playback.rxPlayback.pipe(Rx.Op.take(1)).toPromise()
	console.log(`rxPlayback ->`, new Url(url).pathname, query)

	// let session = await tail.rxHttpServer.toPromise()
	// console.log(`session ->`, session)

	await utils.pTimeout(10000)
	reply.redirect(`/dev/null`)
	// reply.redirect(`https://miriam.makefast.co/dl/SewyeARRQy52TW6yrcM3YQ/1556551274/675000842/5ba4f74d335200.99795817/Sicario.Day.Of.The.Soldado.2018.1080p.BluRay.x264-%5BYTS.AM%5D.mp4`)
})

async function listen() {
	await fastify.listen(emby.STRM_PORT)
}
process.nextTick(() => listen().catch(error => console.error(`fastify listen -> %O`, error)))

type StrmQuery = trakt.IDs & { type: media.MainContentType; s: number; e: number }

// const PriorityQueue = (new PQueue() as any)._queueClass as PQueue.QueueClassConstructor<
// 	PQueue.DefaultAddOptions & { id: string }
// >
// class QueueClass extends PriorityQueue {
// 	ids = [] as string[]
// }
// const queue = new PQueue({ queueClass: QueueClass })
