import * as Fastify from 'fastify'
import * as qs from '@/shims/query-string'
import exithook = require('exit-hook')

export default (port: string) => {
	let fastify = Fastify({ querystringParser: query => qs.parse(query) })
	fastify.server.headersTimeout = 60000
	fastify.server.keepAliveTimeout = 25000
	fastify.server.timeout = 60000
	process.nextTick(() => {
		fastify.listen(port).then(
			address => {
				console.info(`address '${port}' ->`, address)
				exithook(() => fastify.close())
			},
			error => console.error(`listen '${port}' -> %O`, error)
		)
	})
	return fastify
}


