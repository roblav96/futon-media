import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as http from '@/adapters/http'
import * as magnetlink from '@/shims/magnet-link'
import * as pAll from 'p-all'
import * as path from 'path'
import * as trackers from '@/scrapers/trackers'
import * as utils from '@/utils/utils'

export const client = new http.Http({
	baseUrl: 'https://api.real-debrid.com/rest/1.0',
	headers: { authorization: `Bearer ${process.env.REALDEBRID_SECRET}` },
})

process.nextTick(async () => {
	if (!process.DEVELOPMENT) return
	if (process.DEVELOPMENT) return
	let transfers = (await client.get('/torrents', { silent: true })) as Transfer[]
	transfers = transfers.filter(v => v.status != 'downloaded' || !v.filename)
	for (let i = 0; i < transfers.length; i++) {
		transfers[i] = (await client.get(`/torrents/info/${transfers[i].id}`)) as Transfer
	}
	console.log(`RealDebrid transfers ->`, transfers)
	let tkeys = ['original_filename', 'progress', 'seeders']
	console.log(
		`RealDebrid transfers ->`,
		transfers.map(v => _.pick(v, tkeys)),
	)
})

export class RealDebrid extends debrid.Debrid<Transfer> {
	static async cached(hashes: string[]) {
		hashes = hashes.map(v => v.toLowerCase())
		let chunks = utils.chunks(hashes, 100)
		let cached = hashes.map(v => false)
		await pAll(
			chunks.map(chunk => async () => {
				await utils.pRandom(300)
				let url = `/torrents/instantAvailability/${chunk.join('/')}`
				let response = (await client
					.get(url, {
						memoize: process.DEVELOPMENT,
						silent: true,
					})
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
		let actives = (await client.get('/torrents/activeCount', {
			silent: true,
		})) as ActiveCount
		return actives.list.length < _.ceil(actives.limit * 0.8)
	}

	static async download(magnet: string) {
		let { dn, infoHash } = magnetlink.decode(magnet)

		let transfers = (await client.get('/torrents')) as Transfer[]
		let transfer = transfers.find(v => v.hash.toLowerCase() == infoHash)
		if (transfer) {
			console.warn(`RealDebrid download transfer exists ->`, dn)
			return true
		}

		let download = (await client.post('/torrents/addMagnet', {
			form: { magnet: magnet },
		})) as Download
		await utils.pTimeout(1000)
		transfer = (await client.get(`/torrents/info/${download.id}`)) as Transfer

		if (transfer.files.length == 0) {
			client.delete(`/torrents/delete/${transfer.id}`).catch(_.noop)
			throw new Error(`RealDebrid transfer files == 0`)
		}

		let files = transfer.files.filter(v => {
			if (v.path.toLowerCase().includes('rarbg.com.mp4')) return false
			return utils.isVideo(v.path)
		})
		if (files.length == 0) {
			console.warn(`RealDebrid files == 0/${transfer.files.length} ->`, dn)
			client.delete(`/torrents/delete/${transfer.id}`).catch(_.noop)
			return false
		}

		await client
			.post(`/torrents/selectFiles/${transfer.id}`, {
				form: { files: files.map(v => v.id).join() },
			})
			.catch(error => {
				client.delete(`/torrents/delete/${transfer.id}`).catch(_.noop)
				return Promise.reject(error)
			})
		return true
	}

	async getFiles() {
		let response = (await client.get(
			`/torrents/instantAvailability/${this.infoHash}`,
		)) as CacheResponse
		let rds = _.get(response, `${this.infoHash}.rd`, []) as CacheFile[]

		_.remove(rds, rd => {
			let names = _.toPairs(rd).map(([id, file]) => file.filename)
			return names.find(v => !utils.isVideo(v))
		})
		rds.sort((a, b) => {
			let [asize, bsize] = [a, b].map(v =>
				_.sum(_.toPairs(v).map(([id, file]) => file.filesize)),
			)
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
		let transfers = (await client.get('/torrents')) as Transfer[]
		let transfer = transfers.find(v => v.hash.toLowerCase() == this.infoHash)

		if (transfer) {
			transfer = (await client.get(`/torrents/info/${transfer.id}`)) as Transfer
		} else {
			let download = (await client.post('/torrents/addMagnet', {
				form: { magnet: this.magnet },
			})) as Download
			await client.post(`/torrents/selectFiles/${download.id}`, {
				form: { files: this.files.map(v => v.id).join() },
			})
			transfer = (await client.get(`/torrents/info/${download.id}`)) as Transfer
			client.delete(`/torrents/delete/${download.id}`).catch(_.noop)
		}
		if (transfer.files.length == 0) {
			console.warn(`RealDebrid transfer files == 0 ->`, this.dn)
			return
		}
		if (transfer.links.length == 0) {
			console.warn(`RealDebrid transfer links == 0 ->`, this.dn)
			return
		}

		let selected = transfer.files.filter(v => v.selected == 1)
		let index = selected.findIndex(v => v.path.includes(file.name))
		let link = transfer.links[index]
		if (!link) {
			console.warn(`RealDebrid transfer !link ->`, this.dn, index, transfer.links, selected)
			return
		}

		// throw new Error(`RealDebrid streamUrl -> disabled`)
		let { download } = (await client.post(`/unrestrict/link`, { form: { link } })) as Unrestrict
		return download
	}
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
	path: string
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
