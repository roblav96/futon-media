import * as _ from 'lodash'
import * as fastParse from 'fast-json-parse'
import * as fs from 'fs-extra'
import * as level from 'level'
import * as matcher from 'matcher'
import * as path from 'path'
import * as pkgup from 'read-pkg-up'
import * as ttl from 'level-ttl'
import fastStringify from 'fast-safe-stringify'
import { LevelDown } from 'leveldown'
import { LevelUp } from 'levelup'

class Db {
	static get base() {
		let pkgjson = pkgup.sync({ cwd: __dirname })
		return path.join(path.dirname(pkgjson.path), 'node_modules/.cache/leveldb')
	}
	static file(name: string) {
		let file = path.join(Db.base, `${name}.db`)
		fs.ensureDirSync(file)
		return file
	}

	level = ttl(level(Db.file(this.path))) as LevelUp<LevelDown>
	constructor(public path: string) {}

	async get(key: string) {
		try {
			let { err, value } = fastParse(await this.level.get(key))
			if (err) {
				console.error(`db get '${key}' fastParse err -> %O`, err)
				throw err
			}
			return value
		} catch {}
	}

	async put(key: string, value: any, ttl?: number) {
		try {
			return await this.level.put(key, fastStringify(value), _.isFinite(ttl) ? { ttl } : {})
		} catch (error) {
			console.error(`db put '${key}' -> %O`, error)
		}
	}

	async del(key: string) {
		try {
			return await this.level.del(key)
		} catch (error) {
			console.error(`db del '${key}' -> %O`, error)
		}
	}

	async keys() {
		return await new Promise<string[]>(resolve => {
			let keys = [] as string[]
			let stream = this.level.createKeyStream()
			stream.once('error', error => console.error(`db keys -> %O`, error))
			stream.on('data', key => keys.push(key))
			stream.on('end', () => {
				resolve(keys.filter(v => !v.startsWith('!ttl!')))
				process.nextTick(() => stream.removeAllListeners())
			})
		})
	}

	async flush(pattern: string) {
		let keys = (await this.keys()).filter(key => matcher.isMatch(key, pattern))
		process.DEVELOPMENT && console.warn(`db flush '${pattern}' ->`, keys.sort())
		if (keys.length == 0) return
		await Promise.all(keys.map(key => this.del(key)))
	}
}

// process.DEVELOPMENT && !(fs.removeSync(Db.base) as any) && console.warn(`removed ->`, Db.base)

export const db = new Db(path.basename(__filename))
export default db

if (process.DEVELOPMENT) {
	process.nextTick(async () => _.defaults(global, await import('@/adapters/db')))
}
