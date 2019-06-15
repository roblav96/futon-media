import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as qs from '@/shims/query-string'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import Fastify from '@/adapters/fastify'

const fastify = Fastify(emby.env.PROXY_PORT)

fastify.all('/emby/*', async (request, reply) => {
	console.log(`/emby ->`, request.raw.url)
	reply.redirect(301, `${emby.env.URL}${request.raw.url}`)
})
