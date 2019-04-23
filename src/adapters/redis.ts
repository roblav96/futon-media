import * as _ from 'lodash'
import * as pkgup from 'read-pkg-up'
import * as IORedis from 'ioredis'

export class Redis extends IORedis {
	private static opts(opts: IORedis.RedisOptions) {
		let pkgname = pkgup.sync({ cwd: __dirname }).pkg.name
		_.defaults(opts, {
			connectionName: _.trim(`${process.DEVELOPMENT && '[DEV]'} ${pkgname} ${opts.name}`),
			db: 0,
			host: process.env.REDIS_HOST || '127.0.0.1',
			password: process.env.REDIS_PASSWORD,
			port: _.parseInt(process.env.REDIS_PORT) || 6379,
		} as IORedis.RedisOptions)
		if (!process.DEVELOPMENT) {
			opts.path = '/var/run/redis_' + opts.port + '.sock'
			_.unset(opts, 'host')
			_.unset(opts, 'port')
		}
		return opts
	}

	constructor(opts: IORedis.RedisOptions) {
		super(Redis.opts(opts))
	}
}

export const redis = new Redis({ name: 'redis' })
export default redis
