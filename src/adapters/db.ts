import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as IORedis from 'ioredis'
import * as Json from '@/shims/json'
import * as path from 'path'

export class Db {
	static redis = new IORedis(6379, '127.0.0.1')

	constructor(public prefix: string) {
		if (fs.pathExistsSync(prefix)) {
			this.prefix = path.relative(process.mainModule.path, prefix).replace(/\//g, ':')
			this.prefix = this.prefix.slice(0, this.prefix.lastIndexOf('.')).trim()
		}
	}

	async get<T = any>(key: string) {
		let value = await Db.redis.get(`${this.prefix}:${key}`)
		value = Json.parse(value).value || value
		return (value as any) as T
	}

	async put(key: string, value: any, ttl?: number) {
		value = Json.stringify(value)
		if (!_.isFinite(ttl)) await Db.redis.set(`${this.prefix}:${key}`, value)
		else await Db.redis.setex(`${this.prefix}:${key}`, ttl / 1000, value)
	}

	async del(key: string) {
		await Db.redis.del(`${this.prefix}:${key}`)
	}

	async flush(pattern = '*') {
		let keys = await Db.redis.keys(`${this.prefix}:${pattern}`)
		if (keys.length == 0) return
		console.warn(`Db flush '${this.prefix}:${pattern}' ->`, keys.sort())
		await this.pipeline(keys.map(v => ['del', v]))
	}

	async pipeline(coms = [] as string[][]) {
		let results = ((await Db.redis.pipeline(coms).exec()) || []) as any[]
		for (let i = 0; i < results.length; i++) {
			if (results[i][0]) {
				throw new Error(`coms[${i}] ${coms[i]} results[${i}] ${results[i][0]}`)
			}
			results[i] = results[i][1]
		}
		return results
	}
}

export const db = new Db(__filename)
export default db

process.nextTick(async () => {
	process.DEVELOPMENT && _.defaults(global, await import('@/adapters/db'))
	// if (process.DEVELOPMENT) {
	// 	let mocks = await import('@/mocks/mocks')
	// 	await db.put(`UserId:${Math.random().toString()}`, Math.random().toString())
	// 	await db.put('mocks:ant-man-and-the-wasp-2018', mocks.MOVIES['ant-man-and-the-wasp-2018'])
	// 	let entries = await db.entries()
	// 	console.log(`db entriess ->`, entries)
	// }
	// if (process.DEVELOPMENT) {
	// 	let mocks = await import('@/mocks/mocks')
	// 	let all = [mocks.MOVIES, mocks.SHOWS, mocks.EPISODES, mocks.PEOPLE].map(_.values).flat()
	// 	let suite = new (await import('benchmarkify'))().createSuite('db.js', { time: 3000 })
	// 	let db = new Db('benchmarkify')
	// 	await db.flush()
	// 	suite.add('db.put', async done => {
	// 		await db.put(`${Math.random().toString()}`, _.sample(all))
	// 		return done()
	// 	})
	// 	let results = await suite.run()
	// 	console.log(`results ->`, results)
	// }
})
