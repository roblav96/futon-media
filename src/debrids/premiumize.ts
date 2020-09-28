import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as http from '@/adapters/http'
import * as magnetlink from '@/shims/magnet-link'
import * as pAll from 'p-all'
import * as path from 'path'
import * as utils from '@/utils/utils'

export const client = new http.Http({
	baseUrl: 'https://www.premiumize.me/api',
	qsArrayFormat: 'bracket',
	query: {
		customer_id: process.env.PREMIUMIZE_ID,
		pin: process.env.PREMIUMIZE_PIN,
	},
	retries: [503],
	silent: true,
})

export class Premiumize extends debrid.Debrid {
	static async cached(hashes: string[]) {
		hashes = hashes.map((v) => v.toLowerCase())
		let chunks = utils.chunks(hashes, 40)
		let cached = hashes.map((v) => false)
		await pAll(
			chunks.map((chunk, i) => async () => {
				let response = (await client
					.post(`/cache/check`, {
						delay: i > 0 && 300,
						query: { items: chunk },
						memoize: process.env.NODE_ENV == 'development',
					})
					.catch((error) => {
						console.error(`Premiumize cache -> %O`, error)
						return []
					})) as CacheResponse
				chunk.forEach((hash, i) => {
					if (_.get(response, `response[${i}]`) == true) {
						cached[hashes.findIndex((v) => v == hash)] = true
					}
				})
			}),
			{ concurrency: 3 },
		)
		return cached
	}

	static async transfers() {
		let transfers = await client.post('/transfer/list')
		return _.get(transfers, 'transfers', []) as Transfer[]
	}

	static async stalled(id: string) {
		let transfer = (await Premiumize.transfers()).find((v) => v.id == id)
		if (
			transfer &&
			!['seeding', 'success'].includes(transfer.status) &&
			utils.includes(transfer.message, 'loading')
		) {
			await client.post('/transfer/delete', { query: { id } })
		}
	}

	async download() {
		let transfers = await Premiumize.transfers()
		let transfer = transfers.find(({ src }) => {
			if (src && src.startsWith('magnet:?')) {
				return magnetlink.decode(src).infoHash.toLowerCase() == this.infoHash
			}
		})
		if (transfer || transfers.find((v) => utils.equals(v.name, this.dn))) {
			return true
		}
		let { id, status } = (await client.post('/transfer/create', {
			query: { src: this.magnet },
		})) as TransferCreateResponse
		if (!['seeding', 'success'].includes(status)) {
			console.warn(`Premiumize download transfer create status ->`, status)
			return true
		}
		setTimeout(Premiumize.stalled, utils.duration(1, 'minute'), id)
		return true
	}

	async getFiles() {
		let directdls = await client.post(`/transfer/directdl`, {
			query: { src: this.magnet },
		})
		let downloads = _.get(directdls, 'content', []) as Download[]
		_.remove(downloads, (v) => !(v.link || v.stream_link) || !v.path || !v.size)
		downloads = _.uniqWith(downloads, (from, to) => {
			if (to.path != from.path) return false
			_.merge(to, utils.compact(from))
			return true
		})
		return downloads.map((download) => {
			let name = path.basename(`/${download.path}`)
			return {
				bytes: _.parseInt(download.size),
				mkv: download.link,
				mp4: download.stream_link,
				name: name.slice(0, -path.extname(name).length),
				path: `/${download.path}`,
			} as debrid.File
		})
	}

	async streamUrl(file: debrid.File, original: boolean) {
		return !original && file.mp4 ? file.mp4 : file.mkv
	}
}

if (process.env.NODE_ENV == 'development') {
	process.nextTick(async () => _.defaults(global, await import('@/debrids/premiumize')))
}

interface CacheResponse {
	filename: string[]
	filesize: number[]
	response: boolean[]
	status: string
	transcoded: boolean[]
}

interface TransferCreateResponse {
	error: string
	id: string
	message: string
	name: string
	status: string
}

interface Transfer {
	file_id: string
	folder_id: string
	id: string
	message: string
	name: string
	progress: number
	src: string
	status: string
}

interface Download {
	cdn_hostname: string
	created_at: number
	id: string
	link: string
	name: string
	path: string
	size: string
	stream_link: string
	transcode_status: string
	type: string
}

interface Folder {
	content: Download[]
	name: string
	parent_id: string
	status: string
}
