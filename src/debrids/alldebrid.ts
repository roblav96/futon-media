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
	silent: true,
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
						memoize: process.env.NODE_ENV == 'development',
					})
					.catch((error) => {
						console.error(`AllDebrid cache -> %O`, error)
						return {}
					})) as MagnetsResponse<MagnetCache>
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

	private magnetId: number

	async download() {
		let transfers = (await client.get('/magnet/status')) as MagnetsResponse<MagnetStatus>
		let transfer = transfers.data.magnets.find((v) => v.hash.toLowerCase() == this.infoHash)
		if (transfer) return true
		let download = (await client.post('/magnet/upload', {
			query: { magnets: [this.infoHash] },
		})) as MagnetsResponse<MagnetUpload>
		let upload = download.data.magnets.find((v) => v.hash.toLowerCase() == this.infoHash)
		if (!upload.ready) {
			console.warn(`AllDebrid download magnet upload ->`, download.status)
			return true
		}
		return true
	}

	async getFiles() {
		let upload = (
			(await client.post('/magnet/upload', {
				query: { magnets: [this.infoHash] },
			})) as MagnetsResponse<MagnetUpload>
		).data.magnets.find((v) => v.hash.toLowerCase() == this.infoHash)
		if (!upload.ready) {
			throw new Error('!upload.ready')
		}
		let status = (await client.get('/magnet/status', { query: { id: upload.id } })).data
			.magnets as MagnetStatus
		let links = status.links.filter((v) => utils.isVideo(v.filename))
		if (_.isEmpty(links)) {
			throw new Error('_.isEmpty(links)')
		}
		return links.map((link) => {
			return {
				bytes: link.size,
				link: link.link,
				name: link.filename.slice(0, -path.extname(link.filename).length),
				path: `/${link.filename}`,
			} as debrid.File
		})
	}

	async streamUrl(file: debrid.File, original: boolean) {
		let unlock = (await client.get('/link/unlock', { query: { link: file.link } }))
			.data as LinkUnlock
		return unlock.link
	}
}

if (process.env.NODE_ENV == 'development') {
	process.nextTick(async () => _.defaults(global, await import('@/debrids/alldebrid')))
}

export interface MagnetsResponse<T> {
	data: {
		magnets: T[]
	}
	status: string
}
export interface MagnetCache {
	hash: string
	instant: boolean
	magnet: string
	files: {
		n: string
		s: number
	}[]
	error: {
		code: string
		message: string
	}
}
export interface MagnetStatus {
	completionDate: number
	downloadSpeed: number
	downloaded: number
	filename: string
	hash: string
	id: number
	links: MagnetLink[]
	notified: boolean
	seeders: number
	size: number
	status: string
	statusCode: number
	type: string
	uploadDate: number
	uploadSpeed: number
	uploaded: number
}
export interface MagnetLink {
	filename: string
	files: string[]
	link: string
	size: number
}
export interface MagnetUpload {
	filename_original: string
	hash: string
	id: number
	magnet: string
	name: string
	ready: boolean
	size: number
}
export interface LinkUnlock {
	filename: string
	filesize: number
	host: string
	hostDomain: string
	id: string
	link: string
	paws: boolean
	streaming: any[]
	streams: LinkStream[]
}
export interface LinkStream {
	ext: string
	filesize: number
	id: string
	link: string
	name: string
	quality: number
}
