import * as Fastify from 'fastify'
import * as mem from 'mem'
import * as qs from '@/shims/query-string'
import exithook = require('exit-hook')

export default mem((port: string) => {
	let fastify = Fastify({ querystringParser: query => qs.parse(query) })
	fastify.server.headersTimeout = 60000
	fastify.server.keepAliveTimeout = 25000
	fastify.server.timeout = 60000
	fastify.listen(port).then(
		address => {
			console.info(`fastify listen ->`, address)
			exithook(() => fastify.close())
		},
		error => console.error(`fastify listen '${port}' -> %O`, error)
	)
	return fastify
})
