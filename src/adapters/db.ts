import * as _ from 'lodash'
import * as fastParse from 'fast-json-parse'
import * as fs from 'fs-extra'
import * as IORedis from 'ioredis'
import * as path from 'path'
import fastStringify from 'fast-safe-stringify'

export class Db {
	redis: IORedis.Redis

	constructor(public name: string) {
		if (fs.pathExistsSync(name)) {
			this.name = path
				.relative(process.mainModule.path, name)
				.replace(/\//g, ':')
				.slice(0, -3)
		}
		this.redis = new IORedis(6379, '127.0.0.1', { connectionName: this.name, db: 0 })
	}

	async get<T = any>(key: string) {
		let value = await this.redis.get(`${this.name}:${key}`)
		value = fastParse(value).value || value
		return (value as any) as T
	}

	async put(key: string, value: any, ttl?: number) {
		value = fastStringify.stable(value)
		if (!_.isFinite(ttl)) await this.redis.set(`${this.name}:${key}`, value)
		else await this.redis.setex(`${this.name}:${key}`, ttl / 1000, value)
	}

	async del(key: string) {
		await this.redis.del(`${this.name}:${key}`)
	}

	async flush(pattern = '*') {
		let keys = await this.redis.keys(`${this.name}:${pattern}`)
		if (keys.length == 0) return
		console.warn(`[DB] ${this.name} flush '${pattern}' ->`, keys.sort())
		await this.pipeline(keys.map(v => ['del', v]))
	}

	async pipeline(coms = [] as string[][]) {
		let results = ((await this.redis.pipeline(coms).exec()) || []) as any[]
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
