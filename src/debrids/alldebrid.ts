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
	baseUrl: 'https://api.alldebrid.com/v4',
	qsArrayFormat: 'bracket',
	query: {
		agent: process.env.ALLDEBRID_AGENT,
		apikey: process.env.ALLDEBRID_KEY,
	},
	// retries: [503],
	// silent: true,
})

export class AllDebrid extends debrid.Debrid {
	static async cached(hashes: string[]) {
		hashes = hashes.map((v) => v.toLowerCase())
		let chunks = utils.chunks(hashes, 40)
		let cached = hashes.map((v) => false)
		await pAll(
			chunks.map((chunk, i) => async () => {
				let response = (await client
					.get('/magnet/instant', {
						delay: i > 0 && 300,
						query: { magnets: chunk },
						memoize: process.DEVELOPMENT,
					})
					.catch((error) => {
						console.error(`AllDebrid cache -> %O`, error)
						return {}
					})) as CacheResponse
				chunk.forEach((hash) => {
					let magnet = response.data.magnets.find((v) => v.hash == hash)
					if (magnet && magnet.instant == true) {
						cached[hashes.findIndex((v) => v == hash)] = true
					}
				})
			}),
			{ concurrency: 3 },
		)
		return cached
	}

	async download() {
		let transfers = ((await client.get('/magnet/status')) as TransfersResponse).data.magnets
		let transfer = transfers.find((v) => v.hash.toLowerCase() == this.infoHash)
		if (transfer) return true

		//

		let download = (await client.post('/torrents/addMagnet', {
			form: { magnet: this.magnet },
		})) as Download
		await utils.pTimeout(3000)
		let files = await RealDebrid.getTorrentFiles(download.id)

		try {
			_.remove(files, (v) => !utils.isVideo(v.name))
			if (_.isEmpty(files)) {
				throw new Error('isEmpty files')
			}
			if (_.isEmpty(files.filter((v) => v.selected == 1))) {
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
		let pairs = (await this.getCacheFiles()).map((v) => _.toPairs(v)).flat()
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
		let ids = Object.keys(rds.find((v) => _.isPlainObject(v[file.id.toString()])))
		let { id } = (await client.post('/torrents/addMagnet', {
			form: { magnet: this.magnet },
		})) as Download
		await utils.pTimeout(1000)
		await client.post(`/torrents/selectFiles/${id}`, {
			form: { files: ids.join() },
		})
		let transfer = (await client.get(`/torrents/info/${id}`)) as Transfer
		client.delete(`/torrents/delete/${id}`).catch(_.noop)
		let selected = transfer.files.filter((v) => v.selected == 1)
		let link = transfer.links[selected.findIndex((v) => v.id == file.id)]
		let unrestrict = (await client.post(`/unrestrict/link`, {
			form: { link, remote: '1' },
		})) as Unrestrict
		return unrestrict.download
	}
}

if (process.DEVELOPMENT) {
	process.nextTick(async () => _.defaults(global, await import('@/debrids/alldebrid')))
}

export interface CacheResponse {
	data: {
		magnets: {
			hash: string
			instant: boolean
			magnet: string
		}[]
	}
	status: string
}

export interface TransfersResponse {
	data: {
		magnets: Transfer[]
	}
	status: string
}
export interface Transfer {
	downloadSpeed: number
	downloaded: number
	filename: string
	hash: string
	id: number
	links: {
		filename: string
		link: string
		size: number
	}[]
	seeders: number
	size: number
	status: string
	statusCode: number
	type: string
	uploadDate: number
	uploadSpeed: number
	uploaded: number
}
