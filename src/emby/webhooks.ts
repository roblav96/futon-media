import Fastify from '@/adapters/fastify'

const fastify = Fastify(process.env.EMBY_PROXY_PORT)

fastify.post('/webhooks', async (request, reply) => {
	console.warn(`/webhooks ->`, request.raw.url)
	// reply.type('text/html; charset=utf-8').send('<html></html>')
	return Buffer.from('')
})
