import * as _ from 'lodash'
import * as fastParse from 'fast-json-parse'
import * as fs from 'fs-extra'
import * as level from 'level'
import * as levelcodec from 'level-codec'
import * as leveldown from 'leveldown'
import * as levelup from 'levelup'
import * as matcher from 'matcher'
import * as path from 'path'
import * as pkgup from 'read-pkg-up'
import * as ttl from 'level-ttl'
import * as utils from '@/utils/utils'
import * as xdgBasedir from 'xdg-basedir'

export class Db {
	level: levelup.LevelUp<leveldown.LevelDown>

	constructor(public name: string) {
		if (fs.pathExistsSync(name)) {
			this.name = path.relative(process.mainModule.path, name).replace(/\//g, '-')
		}
		let pkg = pkgup.sync({ cwd: __dirname }).packageJson
		let location = path.join(xdgBasedir.cache, `${pkg.name}@${pkg.version}`, this.name)
		fs.ensureDirSync(path.dirname(location))
		let db = level(`${location}.db`, {
			valueEncoding: 'json',
		} as Partial<leveldown.LevelDownOpenOptions & levelcodec.CodecOptions>)
		this.level = ttl(db, { sub: level(`${location}.ttl.db`) })
	}

	get<T = any>(key: string) {
		return new Promise<T>(resolve => {
			this.level.get(key, (error, value) => resolve(value as any))
		})
	}

	put(key: string, value: any, ttl?: number) {
		let options = _.isFinite(ttl) ? { ttl } : {}
		return new Promise(resolve => {
			this.level.put(key, value, options, error => {
				if (error) console.error(`[DB] ${this.name} put '${key}'  -> %O`, error.message)
				resolve()
			})
		})
	}

	del(key: string) {
		return new Promise(resolve => {
			this.level.del(key, error => {
				if (error) console.error(`[DB] ${this.name} del '${key}'  -> %O`, error.message)
				resolve()
			})
		})
	}

	entries<T = any>() {
		return new Promise<[string, T][]>((resolve, reject) => {
			let entries = [] as [string, T][]
			let stream = this.level.createReadStream() as NodeJS.ReadStream
			stream.once('error', error => reject(error))
			stream.on('data', ({ key, value }: any) => entries.push([key, value]))
			stream.on('end', () => resolve(entries))
		})
	}
	async keys() {
		return (await this.entries()).map(([key, value]) => key)
	}
	async values() {
		return (await this.entries()).map(([key, value]) => value)
	}

	async flush(pattern = '*') {
		let keys = (await this.keys()).filter(key => matcher.isMatch(key, pattern))
		if (keys.length == 0) return
		console.warn(`[DB] ${this.name} flush '${pattern}' ->`, keys.sort())
		await Promise.all(keys.map(key => this.del(key)))
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
