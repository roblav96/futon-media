import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as Fastify from 'fastify'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import redis from '@/adapters/redis'

export const fastify = Fastify({ logger: false })

fastify.server.headersTimeout = 30000
fastify.server.keepAliveTimeout = 15000
fastify.server.timeout = 60000

fastify.after(error => error && console.error(`after -> %O`, error))

fastify.get('/strm', async (request, reply) => {
	console.log(`request ->`, request.query)
	// await utils.pTimeout(5000)
	reply.redirect(
		// `https://gina.spacecowboy.network/dl/zeuxYAJEADDewGbeHgSOWQ/1556550856/675000842/5b97da93c7c4f4.63098146/Sicario.Day.of.the.Soldado.2018.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTG.mkv`
		`https://miriam.makefast.co/dl/SewyeARRQy52TW6yrcM3YQ/1556551274/675000842/5ba4f74d335200.99795817/Sicario.Day.Of.The.Soldado.2018.1080p.BluRay.x264-%5BYTS.AM%5D.mp4`
	)
})

async function listen() {
	let info = await redis.info()
	// console.log(`info ->`, info)
	await fastify.listen(emby.STRM_PORT)
}
process.nextTick(() => listen().catch(error => console.error(`strm-files listen -> %O`, error)))
