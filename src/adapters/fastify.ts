import * as _ from 'lodash'
import * as mem from 'mem'
import * as qs from 'query-string'
import cors from 'fastify-cors'
import exitHook = require('exit-hook')
import Fastify from 'fastify'
import multipart from 'fastify-multipart'

export default mem((port: string) => {
	let fastify = Fastify({
		connectionTimeout: 60000,
		keepAliveTimeout: 30000,
		querystringParser: (query) => qs.parse(query),
	})
	fastify.register(multipart)
	fastify.register(cors)
	fastify.setErrorHandler((error, request, reply) => {
		console.error('fastify.setErrorHandler -> %O', error)
		reply.send({ error: error.message })
	})
	fastify.server.headersTimeout = 60000
	fastify.server.keepAliveTimeout = 30000
	fastify.server.requestTimeout = 60000
	fastify.server.timeout = 60000
	fastify.listen(_.parseInt(port)).then(
		(address) => {
			console.info(`fastify listen ->`, address)
			exitHook(() => fastify.close())
		},
		(error) => console.error(`fastify listen '${port}' -> %O`, error),
	)
	return fastify
})
