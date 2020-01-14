import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as http from '@/adapters/http'
import * as magnetlink from '@/shims/magnet-link'
import * as pAll from 'p-all'
import * as path from 'path'
import * as utils from '@/utils/utils'

export const client = new http.Http({
	baseUrl: 'https://www.premiumize.me/api',
	query: { customer_id: process.env.PREMIUMIZE_ID, pin: process.env.PREMIUMIZE_PIN },
	qsArrayFormat: 'bracket',
	silent: true,
})

process.nextTick(async () => {
	if (!process.DEVELOPMENT) return
	if (process.DEVELOPMENT) return
	let { transfers } = (await client.post('/transfer/list')) as { transfers: Transfer[] }
	for (let transfer of transfers) {
		if (utils.includes(transfer.message, 'loading')) {
			await client.post('/transfer/delete', { query: { id: transfer.id } })
		}
	}
})

export class Premiumize extends debrid.Debrid<Transfer> {
	static async cached(hashes: string[]) {
		hashes = hashes.map(v => v.toLowerCase())
		let chunks = utils.chunks(hashes, 40)
		let cached = hashes.map(v => false)
		await pAll(
			chunks.map((chunk, i) => async () => {
				let response = (await client
					.post(`/cache/check`, {
						delay: i > 0 && 300,
						query: { items: chunk },
						memoize: process.DEVELOPMENT,
					})
					.catch(error => {
						console.error(`Premiumize cache -> %O`, error)
						return []
					})) as CacheResponse
				chunk.forEach((hash, i) => {
					if (_.get(response, `response[${i}]`) == true) {
						cached[hashes.findIndex(v => v == hash)] = true
					}
				})
			}),
			{ concurrency: 3 },
		)
		return cached
	}

	static async stalled(id: string) {
		let { transfers } = (await client.post('/transfer/list')) as { transfers: Transfer[] }
		let transfer = transfers.find(v => v.id == id)
		if (transfer && transfer.message.includes('loading')) {
			await client.post('/transfer/delete', { query: { id } })
		}
	}

	static async download(magnet: string) {
		let { dn } = magnetlink.decode(magnet)

		let { transfers } = (await client.post('/transfer/list')) as { transfers: Transfer[] }
		if (transfers.find(v => utils.equals(v.name, dn))) {
			console.warn(`Premiumize download transfer exists ->`, dn)
			return true
		}

		let { id, status } = (await client.post('/transfer/create', {
			query: { src: magnet },
		})) as TransferCreateResponse
		console.log(`Premiumize download status ->`, status)
		if (status == 'success') {
			setTimeout(Premiumize.stalled, utils.duration(1, 'minute'), id)
			return true
		}
		return false
	}

	async getFiles() {
		let downloads = (
			await client.post(`/transfer/directdl`, {
				query: { src: this.magnet },
			})
		).content as Download[]
		downloads = (downloads || []).filter(v => !!v.link && !!v.path && !!v.size)
		downloads = _.uniqBy(downloads, 'path')

		this.files = downloads.map(download => {
			let name = path.basename(`/${download.path}`)
			return {
				bytes: _.parseInt(download.size),
				link: download.link,
				name: name.slice(0, name.lastIndexOf('.')),
				path: `/${download.path}`,
			} as debrid.File
		})
		_.remove(this.files, file => !utils.isVideo(file.path))
		// _.remove(this.files, file => {
		// 	if (file.path.toLowerCase().includes('rarbg.com.mp4')) return true
		// 	return !utils.isVideo(file.path)
		// })
		// this.files.sort((a, b) => utils.parseInt(a.path) - utils.parseInt(b.path))
		return this.files
	}

	async streamUrl(file: debrid.File) {
		return file.link
	}
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
