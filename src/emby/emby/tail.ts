import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as execa from 'execa'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as sane from 'sane'
import * as qs from 'query-string'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import exithook = require('exit-hook')

export const rxTail = new Rx.Subject<string>()

process.nextTick(async () => {
	let [{ LogPath }, [{ Name }]] = (await Promise.all([
		emby.client.get('/System/Info', { silent: true }),
		emby.client.get('/System/Logs', { silent: true }),
	])) as [SystemInfo, SystemLog[]]
	Tail.logfile = path.join(LogPath, Name)
	exithook(() => Tail.tail && Tail.tail.destroy())
	schedule.scheduleJob('*/5 * * * * *', () => Tail.check()).invoke()
})

class Tail {
	static tail: Tail
	static logfile: string
	static check() {
		if (!Tail.logfile) return console.warn(`Tail !Tail.logfile`)
		if (!fs.pathExistsSync(Tail.logfile)) return console.warn(`Tail !fs.pathExistsSync`)
		if (Tail.tail && !Tail.tail.child.killed) return console.log(`Tail tailing...`)
		Tail.tail = new Tail(Tail.logfile)
	}

	// watcher: fs.FSWatcher
	watcher: sane.Watcher
	child: execa.ExecaChildProcess
	constructor(logfile: string) {
		console.log(`new Tail ->`, path.basename(logfile))

		this.watcher = sane(logfile, {})
		this.watcher.once('ready', () => {
			console.log(`Tail watcher ready`)
		})
		this.watcher.once('add', (path, root) => {
			console.warn(`Tail watcher add ->`, path, root)
			this.destroy()
		})
		this.watcher.once('change', (path, root) => {
			console.warn(`Tail watcher change ->`, path, root)
			this.destroy()
		})
		this.watcher.once('delete', (path, root) => {
			console.warn(`Tail watcher delete ->`, path, root)
			this.destroy()
		})
		this.watcher.once('error', error => {
			console.error(`Tail watcher error -> %O`, error)
			this.destroy()
		})

		// this.watcher = fs.watch(logfile)
		// this.watcher.once('change', (type: string, file: string) => {
		// 	console.warn(`Tail watcher change ->`, type, file)
		// 	this.destroy()
		// })
		// this.watcher.once('error', error => {
		// 	console.error(`Tail watcher -> %O`, error)
		// 	this.destroy()
		// })

		this.child = execa('tail', ['-fn0', logfile], { killSignal: 'SIGTERM' })
		this.child.stdout.on('data', (chunk: string) => {
			chunk = `\n${_.trim((chunk || '').toString())}`
			let lines = chunk.split(/\n\d{4}-\d{2}-\d{2}\s/g)
			for (let line of lines) {
				line = _.trim(line || '')
				line && rxTail.next(line)
			}
		})
		this.child.stderr.once('data', (chunk: string) => {
			console.error(`Tail child stderr -> %O`, _.trim((chunk || '').toString()))
			this.destroy()
		})
		this.child.once('error', error => {
			console.error(`Tail child error -> %O`, error)
			this.destroy()
		})
		this.child.once('close', (code, signal) => {
			console.warn(`Tail child close ->`, code, signal)
			this.destroy()
		})
		this.child.once('disconnect', () => {
			console.warn(`Tail child disconnect`)
			this.destroy()
		})
		this.child.once('exit', (code, signal) => {
			console.error(`Tail child exit ->`, code, signal)
			this.destroy()
		})
	}

	destroy = _.once(() => {
		console.warn(`Tail destroy`)
		this.child.kill('SIGTERM')
		this.watcher.close()
		process.nextTick(() => {
			this.child.removeAllListeners()
			this.child.stdout.removeAllListeners()
			this.child.stderr.removeAllListeners()
			this.watcher.removeAllListeners()
		})
	})
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

export interface SystemInfo {
	CachePath: string
	CanLaunchWebBrowser: boolean
	CanSelfRestart: boolean
	CanSelfUpdate: boolean
	CompletedInstallations: any[]
	HardwareAccelerationRequiresPremiere: boolean
	HasPendingRestart: boolean
	HasUpdateAvailable: boolean
	HttpServerPortNumber: number
	HttpsPortNumber: number
	Id: string
	InternalMetadataPath: string
	IsShuttingDown: boolean
	ItemsByNamePath: string
	LocalAddress: string
	LogPath: string
	OperatingSystem: string
	OperatingSystemDisplayName: string
	ProgramDataPath: string
	ServerName: string
	SupportsAutoRunAtStartup: boolean
	SupportsHttps: boolean
	SupportsLibraryMonitor: boolean
	SystemUpdateLevel: string
	TranscodingTempPath: string
	Version: string
	WanAddress: string
	WebSocketPortNumber: number
}

export interface SystemLog {
	DateCreated: string
	DateModified: string
	Name: string
	Size: number
}
