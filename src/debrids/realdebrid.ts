import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as debrid from '@/debrids/debrid'
import * as http from '@/adapters/http'
import * as magnetlink from '@/shims/magnet-link'
import * as pAll from 'p-all'
import * as path from 'path'
import * as trackers from '@/scrapers/trackers'
import * as utils from '@/utils/utils'

const client = new http.Http({
	baseUrl: 'https://api.real-debrid.com/rest/1.0',
	headers: {
		authorization: `Bearer ${process.env.REALDEBRID_SECRET}`,
	},
	// retries: [503],
	silent: true,
})
const ajax = new http.Http({
	baseUrl: 'https://real-debrid.com/ajax',
	headers: {
		cookie: `https=1; cookie_accept=y; auth=${process.env.REALDEBRID_COOKIE}; lang=en; apay-session-set=true`,
	},
	// retries: [503],
	// silent: true,
})

export class RealDebrid extends debrid.Debrid {
	static async cached(hashes: string[]) {
		hashes = hashes.map(v => v.toLowerCase())
		let chunks = utils.chunks(hashes, 40)
		let cached = hashes.map(v => false)
		await pAll(
			chunks.map((chunk, i) => async () => {
				let url = `/torrents/instantAvailability/${chunk.join('/')}`
				let response = (await client
					.get(url, { delay: i > 0 && 300, memoize: process.DEVELOPMENT })
					.catch(error => {
						console.error(`RealDebrid cache -> %O`, error)
						return {}
					})) as CacheResponse
				chunk.forEach(hash => {
					if (_.isPlainObject(_.get(response, `${hash}.rd[0]`))) {
						cached[hashes.findIndex(v => v == hash)] = true
					}
				})
			}),
			{ concurrency: 3 },
		)
		return cached
	}

	static async hasActiveCount() {
		let actives = (await client.get('/torrents/activeCount')) as ActiveCount
		return actives.list.length < _.ceil(actives.limit * 0.8)
	}

	static async getTorrentFiles(id: string) {
		let $ = cheerio.load(await ajax.get('/torrent_files.php', { query: { id } }))
		let files = [] as File[]
		$('.torrent_file_checkbox').each((i, el) => {
			let $el = $(el)
			let children = $el.nextAll('span').first()
			files.push({
				bytes: utils.toBytes(children.find('i').text()),
				id: _.parseInt($el.attr('id').replace('file_', '')),
				name: children[0].children.find(v => v.type == 'text').data.slice(0, -2),
				selected: $el.attr('checked') == 'checked' ? 1 : 0,
			} as File)
		})
		return files
	}
	static async postTorrentFiles(id: string, files: File[]) {
		let response = await ajax.post('/torrent_files.php', {
			query: { id },
			form: {
				files_unwanted: files
					.filter(v => v.selected == 1)
					.map(v => v.id)
					.join(','),
				start_torrent: 1,
			},
		})
		return response == 'OK'
	}

	async download() {
		let transfers = (await client.get('/torrents', { query: { limit: 100 } })) as Transfer[]
		let transfer = transfers.find(v => v.hash.toLowerCase() == this.infoHash)
		if (transfer) return true

		let download = (await client.post('/torrents/addMagnet', {
			form: { magnet: this.magnet },
		})) as Download
		await utils.pTimeout(3000)
		let files = await RealDebrid.getTorrentFiles(download.id)

		try {
			_.remove(files, v => !utils.isVideo(v.name))
			if (_.isEmpty(files)) {
				throw new Error('isEmpty files')
			}
			if (_.isEmpty(files.filter(v => v.selected == 1))) {
				throw new Error('isEmpty files selected')
			}
			let ok = await RealDebrid.postTorrentFiles(download.id, files)
			if (!ok) throw new Error('!ok')
			return true
		} catch (error) {
			console.warn(`RealDebrid download '${error.message}' ->`, this.dn)
			client.delete(`/torrents/delete/${download.id}`).catch(_.noop)
			return true
		}
	}

	async getCacheFiles() {
		let response = (await client.get(
			`/torrents/instantAvailability/${this.infoHash}`,
		)) as CacheResponse
		let rds = _.get(response, `${this.infoHash}.rd`, []) as CacheFile[]
		return rds.sort((a, b) => _.size(b) - _.size(a))
	}
	async getFiles() {
		let pairs = (await this.getCacheFiles()).map(v => _.toPairs(v)).flat()
		return _.uniqBy(pairs, '[0]').map(([id, file]) => {
			return {
				bytes: file.filesize,
				id: _.parseInt(id),
				name: file.filename.slice(0, -path.extname(file.filename).length),
				path: `/${file.filename}`,
			} as debrid.File
		})
	}

	async streamUrl(file: debrid.File, original: boolean) {
		let rds = await this.getCacheFiles()
		let ids = Object.keys(rds.find(v => _.isPlainObject(v[file.id.toString()])))
		let { id } = (await client.post('/torrents/addMagnet', {
			form: { magnet: this.magnet },
		})) as Download
		await utils.pTimeout(1000)
		await client.post(`/torrents/selectFiles/${id}`, {
			form: { files: ids.join() },
		})
		let transfer = (await client.get(`/torrents/info/${id}`)) as Transfer
		client.delete(`/torrents/delete/${id}`).catch(_.noop)
		let selected = transfer.files.filter(v => v.selected == 1)
		let link = transfer.links[selected.findIndex(v => v.id == file.id)]
		let unrestrict = (await client.post(`/unrestrict/link`, {
			form: { link, remote: '1' },
		})) as Unrestrict
		return unrestrict.download
	}
}

if (process.DEVELOPMENT) {
	process.nextTick(async () => _.defaults(global, await import('@/debrids/realdebrid')))
}

export type CacheResponse = Record<string, { rd: CacheFile[] }>
export type CacheFile = Record<string, { filename: string; filesize: number }>

export interface Download {
	id: string
	uri: string
}

export interface File {
	bytes: number
	id: number
	name: string
	selected: number
}

export interface Transfer {
	added: string
	bytes: number
	filename: string
	files: File[]
	hash: string
	host: string
	id: string
	links: string[]
	original_bytes: number
	original_filename: string
	progress: number
	seeders: number
	speed: number
	split: number
	status: Status
}

export interface Unrestrict {
	chunks: number
	crc: number
	download: string
	filename: string
	filesize: number
	host: string
	host_icon: string
	id: string
	link: string
	mimeType: string
	streamable: number
}

export interface ActiveCount {
	limit: number
	list: string[]
	nb: number
}

export type Status =
	| 'magnet_error'
	| 'magnet_conversion'
	| 'waiting_files_selection'
	| 'queued'
	| 'downloading'
	| 'downloaded'
	| 'error'
	| 'virus'
	| 'compressing'
	| 'uploading'
	| 'dead'
