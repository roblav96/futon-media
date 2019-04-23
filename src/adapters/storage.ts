import * as _ from 'lodash'
import * as level from 'level'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as pkgup from 'read-pkg-up'
import * as xdgBasedir from 'xdg-basedir'
import { LevelDown } from 'leveldown'
import { LevelUp } from 'levelup'

let pkgjson = pkgup.sync({ cwd: __dirname })
let basepath = path.join(xdgBasedir.config, pkgjson.pkg.name)
if (process.DEVELOPMENT) {
	basepath = path.join(path.dirname(pkgjson.path), `node_modules/.cache`)
}
let dbpath = path.join(basepath, `leveldb/storage.db`)
fs.ensureDirSync(dbpath)
export const db = level(dbpath) as LevelUp<LevelDown>
export default db
