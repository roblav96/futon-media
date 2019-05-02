import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as level from 'level'
import * as path from 'path'
import * as pkgup from 'read-pkg-up'
import * as xdgBasedir from 'xdg-basedir'
import { LevelDown } from 'leveldown'
import { LevelUp } from 'levelup'

function dbPath(name: string) {
	let pkgjson = pkgup.sync({ cwd: __dirname })
	let basepath = path.join(xdgBasedir.config, pkgjson.pkg.name)
	if (process.DEVELOPMENT) {
		basepath = path.join(path.dirname(pkgjson.path), 'node_modules/.cache')
	}
	let dbPath = path.join(basepath, `leveldb/${name}.db`)
	fs.ensureDirSync(dbPath)
	return dbPath
}

export const db = level(dbPath(path.basename(__filename))) as LevelUp<LevelDown>

export default db
