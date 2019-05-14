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
import * as xdgBasedir from 'xdg-basedir'
import fastStringify from 'fast-safe-stringify'

class Db {
	level: levelup.LevelUp<leveldown.LevelDown>

	constructor(name: string) {
		let { pkg } = pkgup.sync({ cwd: __dirname })
		let location = path.join(xdgBasedir.cache, pkg.name, name)
		this.level = level(`${location}.db`, {
			sub: level(`${location}.ttl.db`),
			valueEncoding: {
				buffer: false,
				decode(data) {
					let { err, value } = fastParse(data)
					if (err) console.error(`[DB] decode -> %O`, err)
					return err ? data : value
				},
				encode(data) {
					return fastStringify(data)
				},
				type: 'fast-json',
			},
		} as Partial<leveldown.LevelDownOpenOptions & levelcodec.CodecOptions & { sub: any }>)
	}

	get<T = any>(key: string) {
		return (this.level.get(key).catch(_.noop) as any) as Promise<T>
	}

	put(key: string, value: any, ttl?: number) {
		let options = _.isFinite(ttl) ? { ttl } : {}
		return this.level.put(key, value, options).catch(error => {
			console.error(`[DB] put '${key}' -> %O`, error)
		})
	}

	del(key: string) {
		return this.level.del(key).catch(error => {
			console.error(`[DB] del '${key}' -> %O`, error)
		})
	}

	// entries<T = any>({ keys, values } = {} as leveldown.LevelDownIteratorOptions) {
	entries<T = any>() {
		return new Promise<[string, T][]>((resolve, reject) => {
			let entries = [] as [string, T][]
			let stream = this.level.createReadStream() as NodeJS.ReadStream
			stream.once('error', error => reject(error))
			stream.on('data', ({ key, value }) => entries.push([key, value]))
			stream.on('end', () => resolve(entries))
		})
	}
	async keys() {
		return (await this.entries()).map(([key, value]) => key)
	}
	async values() {
		return (await this.entries()).map(([key, value]) => value)
	}

	async flush(pattern: string) {
		let keys = (await this.keys()).filter(key => matcher.isMatch(key, pattern))
		if (keys.length == 0) return
		console.warn(`[DB] flush '${pattern}' ->`, keys.sort())
		await Promise.all(keys.map(key => this.del(key)))
	}
}

export const db = new Db(path.basename(__filename))
export default db

import * as mocks from '@/mocks/mocks'
process.nextTick(async () => {
	await db.put(`UserId:${Math.random().toString()}`, Math.random().toString())
	await db.put('mocks:ant-man-and-the-wasp-2018', mocks.MOVIES['ant-man-and-the-wasp-2018'])
	let entries = await db.entries()
	console.log(`entriess ->`, entries)

	process.DEVELOPMENT && db.flush('*ttl*')
	process.DEVELOPMENT && _.defaults(global, await import('@/adapters/db'))
})
