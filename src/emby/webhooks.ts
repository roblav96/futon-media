import Fastify from '@/adapters/fastify'

const fastify = Fastify(process.env.EMBY_PROXY_PORT)

fastify.post('/webhooks', async (request, reply) => {
	console.log(`/webhooks ->`, request.url, request.body)
	return ''
})
