import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as qs from '@/shims/query-string'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import Fastify from '@/adapters/fastify'

const fastify = Fastify(process.env.PROXY_PORT)

fastify.all('/emby/*', async (request, reply) => {
	console.warn(`/emby ->`, request.raw.url)
	let url = request.raw.url.slice('/emby'.length)
	console.log(`url ->`, url)
	let response = await emby.client.request({
		url,
		method: request.raw.method.toUpperCase() as any,
	})
	console.log(`response ->`, response.data)
	reply.redirect(301, `${process.env.EMBY_LOCAL_ADDRESS}${request.raw.url}`)
})
