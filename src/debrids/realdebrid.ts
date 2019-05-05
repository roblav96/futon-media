import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as http from '@/adapters/http'
import * as magneturi from 'magnet-uri'
import * as pAll from 'p-all'
import * as path from 'path'
import * as utils from '@/utils/utils'

export const client = new http.Http({
	baseUrl: 'https://api.real-debrid.com/rest/1.0',
	query: {
		auth_token: process.env.REALDEBRID_SECRET,
	},
})

export class RealDebrid extends debrid.Debrid<Item> {
	static async cached(hashes: string[]) {
		hashes = hashes.map(v => v.toLowerCase())
		let chunks = utils.chunks(hashes, 35)
		let cached = hashes.map(v => false)
		await pAll(
			chunks.map(chunk => async () => {
				await utils.pRandom(1000)
				let url = `/torrents/instantAvailability/${chunk.join('/')}`
				let response = (await client.get(url).catch(error => {
					console.error(`RealDebrid cache -> %O`, error)
					return {}
				})) as CacheResponse
				chunk.forEach(hash => {
					if (_.isPlainObject(_.get(response, `${hash}.rd[0]`))) {
						cached[hashes.findIndex(v => v == hash)] = true
					}
				})
			}),
			{ concurrency: 2 }
		)
		return cached
	}

	// async download() {
	// 	!this.transfers && (this.transfers = await client.get('/torrents'))
	// 	let transfer = this.transfers.find(v => v.hash.toLowerCase() == this.infoHash)
	// 	if (transfer) {
	// 		console.warn(`exists ->`, this.dn)
	// 		return transfer.id
	// 	}

	// 	let download = (await client.post('/torrents/addMagnet', {
	// 		form: { magnet: this.magnet },
	// 	})) as Download
	// 	await utils.pTimeout(1000)
	// 	let item = (await client.get(`/torrents/info/${download.id}`)) as Item

	// 	let files = item.files.filter(v => utils.isVideo(v.path))
	// 	if (files.length == 0) {
	// 		console.warn(`files.length == 0 ->`, this.dn)
	// 		await client.delete(`/torrents/delete/${download.id}`)
	// 		return
	// 	}

	// 	await client.post(`/torrents/selectFiles/${download.id}`, {
	// 		form: { files: files.map(v => v.id).join() },
	// 	})
	// 	return download.id
	// }

	async getFiles() {
		let response = (await client.get(
			`/torrents/instantAvailability/${this.infoHash}`
		)) as CacheResponse
		let rds = _.get(response, `${this.infoHash}.rd`, []) as CacheFiles[]

		_.remove(rds, rd => {
			let names = _.toPairs(rd).map(([id, file]) => file.filename)
			return names.find(v => !utils.isVideo(v))
		})
		rds.sort((a, b) => {
			let asize = _.sum(_.toPairs(a).map(([id, file]) => file.filesize))
			let bsize = _.sum(_.toPairs(b).map(([id, file]) => file.filesize))
			return bsize - asize
		})

		this.files = _.toPairs(rds[0]).map(([id, file]) => {
			return {
				bytes: file.filesize,
				id: _.parseInt(id),
				name: file.filename.slice(0, file.filename.lastIndexOf('.')),
				path: `/${file.filename}`,
			} as debrid.File
		})

		this.files.sort((a, b) => a.id - b.id)
		return this.files
	}

	async streamUrl(file: debrid.File) {
		let items = (await client.get('/torrents')) as Item[]
		let item = items.find(v => v.hash.toLowerCase() == this.infoHash)

		if (item) {
			item = (await client.get(`/torrents/info/${item.id}`)) as Item
		} else {
			let download = (await client.post('/torrents/addMagnet', {
				form: { magnet: this.magnet },
			})) as Download
			await client.post(`/torrents/selectFiles/${download.id}`, {
				form: { files: this.files.map(v => v.id).join() },
			})
			item = (await client.get(`/torrents/info/${download.id}`)) as Item
			await client.delete(`/torrents/delete/${download.id}`)
		}
		if (item.links.length == 0) {
			console.warn(`item.links.length == 0 ->`, this.dn)
			return
		}
		if (item.files.length == 0) {
			console.warn(`item.files.length == 0 ->`, this.dn)
			return
		}

		let selected = item.files.filter(v => v.selected == 1)
		let index = selected.findIndex(v => v.path.includes(file.name))
		if (index == -1) {
			console.warn(`index == -1 ->`, this.dn)
			return
		}

		let { download } = (await client.post(`/unrestrict/link`, {
			form: { link: item.links[index] },
		})) as Unrestrict
		if (!utils.isVideo(download)) {
			console.warn(`!utils.isVideo(download) ->`, this.dn)
			return
		}
		return download
	}
}

export type CacheResponse = Record<string, { rd: CacheFiles[] }>
export type CacheFiles = Record<string, { filename: string; filesize: number }>

export interface Download {
	id: string
	uri: string
}

export interface File {
	bytes: number
	id: number
	path: string
	selected: number
}

export interface Item {
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
