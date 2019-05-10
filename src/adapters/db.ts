import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as level from 'level'
import * as path from 'path'
import * as pkgup from 'read-pkg-up'
import * as ttl from 'level-ttl'
import * as xdgBasedir from 'xdg-basedir'
import { LevelDown } from 'leveldown'
import { LevelUp } from 'levelup'

class Db {
	static get base() {
		let pkgjson = pkgup.sync({ cwd: __dirname })
		let base = path.join(xdgBasedir.config, pkgjson.pkg.name)
		if (process.DEVELOPMENT) {
			base = path.join(path.dirname(pkgjson.path), 'node_modules/.cache')
		}
		return path.join(base, 'leveldb')
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
			return (await this.level.get(key)) as string
		} catch (error) {
			return null
		}
	}

	put(key: string, value: string, ttl?: number) {
		return this.level.put(key, value, ttl ? { ttl } : {})
	}

	async del(key: string) {
		try {
			return await this.level.del(key)
		} catch (error) {
			return null
		}
	}

	keys() {
		return new Promise<string[]>(resolve => {
			let keys = [] as string[]
			let stream = this.level.createKeyStream()
			stream.on('data', key => keys.push(key))
			stream.on('end', () => resolve(keys))
		})
	}
}

// process.DEVELOPMENT && !(console.warn(`remove ->`, Db.base) as any) && fs.removeSync(Db.base)

export const db = new Db(path.basename(__filename))
export default db
