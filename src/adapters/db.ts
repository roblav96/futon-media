import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as level from 'level'
import * as path from 'path'
import * as pkgup from 'read-pkg-up'
import * as ttl from 'level-ttl'
import * as xdgBasedir from 'xdg-basedir'
import { LevelDown } from 'leveldown'
import { LevelUp } from 'levelup'

class DB {
	static file(name: string) {
		let pkgjson = pkgup.sync({ cwd: __dirname })
		let basepath = path.join(xdgBasedir.config, pkgjson.pkg.name)
		if (process.DEVELOPMENT) {
			basepath = path.join(path.dirname(pkgjson.path), 'node_modules/.cache')
		}
		let file = path.join(basepath, `leveldb/${name}.db`)
		if (process.DEVELOPMENT) {
			fs.removeSync(file)
		}
		fs.ensureDirSync(file)
		return file
	}

	level = ttl(level(DB.file(this.path))) as LevelUp<LevelDown>
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

	del(key: string) {
		return this.level.del(key)
	}
}

export const db = new DB(path.basename(__filename))
export default db
