import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as Fastify from 'fastify'
import * as playback from '@/emby/playback'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as Url from 'url-parse'
import redis from '@/adapters/redis'

export const fastify = Fastify({ querystringParser: query => qs.parse(query) })

fastify.server.headersTimeout = 30000
fastify.server.keepAliveTimeout = 15000
fastify.server.timeout = 60000

fastify.get('/strm', async (request, reply) => {
	// console.log(`query ->`, query)
	console.log(`request ->`, request)
	console.log(`reply ->`, reply)

	playback.rxPlayback.subscribe(({ url, query }) => {
		console.log(`rxPlayback ->`, new Url(url).pathname, query)
	})

	// let session = await tail.rxHttpServer.toPromise()
	// console.log(`session ->`, session)

	// reply.redirect(`/dev/null`)
	// reply.redirect(`https://miriam.makefast.co/dl/SewyeARRQy52TW6yrcM3YQ/1556551274/675000842/5ba4f74d335200.99795817/Sicario.Day.Of.The.Soldado.2018.1080p.BluRay.x264-%5BYTS.AM%5D.mp4`)
})

async function listen() {
	await fastify.listen(emby.STRM_PORT)
}
process.nextTick(() => listen().catch(error => console.error(`fastify listen -> %O`, error)))
