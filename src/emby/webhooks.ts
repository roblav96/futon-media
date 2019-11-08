import Fastify from '@/adapters/fastify'

const fastify = Fastify(process.env.EMBY_PROXY_PORT)

fastify.post('/webhooks', async (request, reply) => {
	console.warn(`/webhooks ->`, request.raw.url, request.body)
	return ''
})
