import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as execa from 'execa'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import exithook = require('exit-hook')

export const rxTail = new Rx.Subject<string>()

process.nextTick(async () => {
	let { LogPath } = await emby.client.get('/System/Info', { silent: true })
	Tail.logfile = path.join(LogPath, 'embyserver.txt')
	exithook(() => Tail.tail && Tail.tail.destroy())
	schedule.scheduleJob('*/5 * * * * *', () => Tail.check()).invoke()
})

class Tail {
	static tail: Tail
	static logfile: string
	static check() {
		if (!Tail.logfile) return
		if (!fs.pathExistsSync(Tail.logfile)) return
		if (Tail.tail && !Tail.tail.child.killed) return
		Tail.tail = new Tail(Tail.logfile)
	}

	watcher: fs.FSWatcher
	child: execa.ExecaChildProcess
	constructor(logfile: string) {
		console.log(`Tail ->`, path.basename(logfile), logfile)

		if (process.platform == 'darwin') {
			this.watcher = fs.watch(logfile)
			this.watcher.once('change', () => this.destroy())
			this.watcher.once('error', () => this.destroy())
		}

		this.child = execa('tail', ['-fn0', logfile], { killSignal: 'SIGTERM' })
		this.child.stdout.on('data', (chunk: string) => {
			chunk = `\n${_.trim((chunk || '').toString())}`
			let lines = chunk.split(/\n\d{4}-\d{2}-\d{2}\s/g)
			for (let line of lines) {
				line = _.trim(line || '')
				line && rxTail.next(line)
			}
		})
		this.child.stderr.once('data', () => this.destroy())
		this.child.once('error', () => this.destroy())
		this.child.once('close', () => this.destroy())
		this.child.once('disconnect', () => this.destroy())
		this.child.once('exit', () => this.destroy())
	}

	destroy() {
		this.child.kill('SIGTERM')
		this.child.stdout.removeAllListeners()
		this.watcher && this.watcher.close()
	}
}

const JUNK = [
	'.png',
	'/images/',
	'/info/public',
	'/strings/en-us.json',
	'/system/endpoint',
	'/system/info',
	'/system/wakeonlaninfo',
	'/web/manifest.json',
]
export const rxHttp = rxTail.pipe(
	Rx.op.map(line => {
		if (line.match(/Info HttpServer: HTTP [DGP]/)) {
			return (line.match(/\b\s(http.*)\.\s\b/) || [])[1] as string
		}
	}),
	Rx.op.filter(match => !!match),
	Rx.op.map(match => qs.parseUrl(match) as { url: string; query: Record<string, string> }),
	Rx.op.filter(({ url }) => !JUNK.find(v => url.toLowerCase().includes(v))),
	Rx.op.map(({ url, query }) => {
		query = _.mapKeys(query, (v, k) => _.upperFirst(k))
		let parts = new Url(url).pathname.toLowerCase().split('/')
		for (let i = 0; i < parts.length; i++) {
			let [part, next] = [parts[i], parts[i + 1]]
			if (!next) continue
			part == 'users' && next.length == 32 && (query.UserId = next)
			if (['items', 'movies', 'shows', 'episodes'].includes(part)) {
				utils.isNumeric(next) && (query.ItemId = next)
				next.length == 32 && (query.ItemId = next)
			}
		}
		return { url, query }
	})
)
