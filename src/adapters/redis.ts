import * as _ from 'lodash'
import * as IORedis from 'ioredis'
import * as pkgup from 'read-pkg-up'
import * as schedule from 'node-schedule'

export namespace Redis {
	export type Coms = string[][]
	export interface Event<T = any> {
		data: T
		name: string
	}
}

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
		// if (!process.DEVELOPMENT) {
		// 	opts.path = '/var/run/redis_' + opts.port + '.sock'
		// 	_.unset(opts, 'host')
		// 	_.unset(opts, 'port')
		// }
		return opts
	}

	constructor(opts: IORedis.RedisOptions) {
		super(Redis.opts(opts))
	}

	async purge(rkey: string, pattern = ':*') {
		let keys = await this.keys(rkey + pattern)
		console.warn('PURGE ->', rkey + pattern, '->', keys.length)
		await this.coms(keys.map(v => ['del', v]))
		return keys
	}

	async coms(coms = [] as Redis.Coms) {
		let results = ((await this.pipeline(coms).exec()) || []) as any[]
		for (let i = 0; i < results.length; i++) {
			if (results[i][0]) {
				throw new Error(`coms[${i}] ${coms[i]} results[${i}] ${results[i][0]}`)
			}
			results[i] = results[i][1]
		}
		return results
	}

	fixHMget(hmget: any[], keys: string[]) {
		return hmget.reduce((target, value, index) => {
			target[keys[index]] = value
			return target
		}, {})
	}

	toHset(from: any) {
		return Object.entries(from).reduce((target, [key, value]) => {
			target[key] = JSON.stringify(value)
			return target
		}, {})
	}
	fromHget(to: any) {
		for (let key in to) {
			to[key] = JSON.parse(to[key])
		}
		return to
	}
}

export const redis = new Redis({ name: 'redis' })
export default redis

setTimeout(() => schedule.scheduleJob('*/5 * * * * *', () => redis.ping()), 1000)
