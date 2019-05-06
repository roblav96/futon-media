import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrid from '@/debrids/debrid'
import * as fastParse from 'fast-json-parse'
import * as http from '@/adapters/http'
import * as path from 'path'
import * as qs from 'query-string'
import * as realdebrid from '@/debrids/realdebrid'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import Emitter from '@/shims/emitter'
import Sockette from '@/shims/sockette'

export const client = new http.Http({
	baseUrl: 'https://api.put.io/v2',
	headers: {
		authorization: `token ${process.env.PUTIO_TOKEN}`,
	},
})

type PutioEvent<Data = any> = { action: 'create' | 'delete' | 'update'; value: Data }
const rx = {
	file: new Rx.Subject<PutioEvent<File>>(),
	transfer: new Rx.Subject<PutioEvent<Transfer>>(),
	user: new Rx.Subject<PutioEvent<User>>(),
}

process.nextTick(() => {
	let random = Math.random().toString(36)
	let nonce = `${_.random(111, 999)}/${random.slice(-8)}`
	let ws = new Sockette(`wss://socket.put.io/socket/sockjs/${nonce}/websocket`, {
		timeout: 1000,
		maxAttempts: Infinity,
		onerror({ error }) {
			console.error(`putio onerror -> %O`, error)
		},
		onclose({ code, reason }) {
			console.warn(`putio onclose ->`, code, reason)
		},
		onopen({ target }) {
			console.info(`putio onopen ->`, new Url(target.url).pathname)
			ws.json([process.env.PUTIO_TOKEN])
		},
		onmessage({ data }: { data: string }) {
			let { err, value } = fastParse(data.slice(1) || '[]') as { err: Error; value: any[] }
			if (err) return console.error(`putio onmessage -> %O`, err)
			let values = value.map(v => fastParse(v).value || v)
			values.forEach(({ type, value }) => {
				let [target, action] = type.split('_') as string[]
				console.log(`putio onmessage '${type}' ->`, value)
				rx[target] && rx[target].next({ action, value } as PutioEvent)
			})
		},
	})

	if (process.DEVELOPMENT) return
	schedule.scheduleJob('0 * * * *', async () => {
		let { transfers } = (await client.get('/transfers/list', { silent: true })) as Response
		for (let transfer of transfers) {
			let day = dayjs(transfer.created_at).add(1, 'day')
			if (day.valueOf() > Date.now()) continue
			if (transfer.file_id) {
				await client.post('/files/delete', { form: { file_ids: transfer.file_id } })
			}
			await client.post('/transfers/remove', { form: { transfer_ids: transfer.id } })
		}
	})
})

export class Putio extends debrid.Debrid<Transfer> {
	static async cached(hashes: string[]) {
		return hashes.map(v => false)
	}

	// async download() {
	// 	!this.transfers && (this.transfers = (await client.get('/transfers/list')).transfers)
	// 	let transfer = this.transfers.find(v => v.hash.toLowerCase() == this.infoHash)
	// 	if (transfer) {
	// 		console.warn(`exists ->`, this.dn)
	// 		return transfer.id.toString()
	// 	}
	// 	let response = (await client.post('/transfers/add', {
	// 		form: { url: this.magnet },
	// 	})) as Response
	// 	return response.transfer.id.toString()
	// }

	async getFiles() {
		let download = (await realdebrid.client.post('/torrents/addMagnet', {
			form: { magnet: this.magnet },
		})) as realdebrid.Download
		await utils.pTimeout(1000)
		let item = (await realdebrid.client.get(`/torrents/info/${download.id}`)) as realdebrid.Item
		await realdebrid.client.delete(`/torrents/delete/${download.id}`)

		let files = item.files.filter(v => utils.isVideo(v.path))
		this.files = files.map(file => {
			let name = path.basename(file.path)
			return {
				bytes: file.bytes,
				name: name.slice(0, name.lastIndexOf('.')),
				path: file.path,
			} as debrid.File
		})

		this.files.sort((a, b) => a.id - b.id)
		return this.files
	}

	async streamUrl(file: debrid.File) {
		let { transfers } = (await client.get('/transfers/list')) as Response
		let transfer = transfers.find(v => v.hash.toLowerCase() == this.infoHash)
		if (!transfer) {
			let response = (await client.post('/transfers/add', {
				form: { url: this.magnet },
			})) as Response
			transfer = response.transfer
		}

		let rxCompleted = rx.transfer.pipe(
			Rx.op.filter(({ action, value }) => action == 'update' && value.id == transfer.id),
			Rx.op.filter(({ value }) => ['COMPLETED', 'DOWNLOADING'].includes(value.status)),
			Rx.op.map(({ value }) => value.status == 'COMPLETED'),
			Rx.op.take(1)
		)
		let completed = await rxCompleted.toPromise()
		if (!completed) {
			await client.post('/transfers/remove', { form: { transfer_ids: transfer.id } })
			return
		}

		let { media_links } = (await client.post('/files/get-download-links', {
			form: { file_ids: transfer.file_id },
		})) as Response
		if (_.size(media_links) == 0) return
		let levens = media_links.map(link => {
			let base = path.basename(qs.parseUrl(link).url)
			return { link, leven: utils.leven(base, file.name) }
		})
		return levens.sort((a, b) => a.leven - b.leven)[0].link
	}
}

interface File {
	content_type: string
	crc32: string
	created_at: string
	extension: string
	file_type: string
	first_accessed_at: any
	folder_type: string
	icon: string
	id: number
	is_hidden: boolean
	is_mp4_available: boolean
	is_shared: boolean
	name: string
	opensubtitles_hash: string
	parent_id: number
	screenshot: string
	size: number
	start_from: number
	updated_at: string
}

interface Transfer {
	availability: any
	callback_url: any
	client_ip: any
	completion_percent: number
	created_at: string
	created_torrent: boolean
	current_ratio: number
	down_speed: number
	download_id: number
	downloaded: number
	error_message: any
	estimated_time: any
	extract: boolean
	file_id: number
	finished_at: string
	hash: string
	id: number
	is_private: boolean
	links: any[]
	name: string
	peers_connected: number
	peers_getting_from_us: number
	peers_sending_to_us: number
	percent_done: number
	save_parent_id: number
	seconds_seeding: any
	simulated: boolean
	size: number
	source: string
	status: string
	status_message: string
	subscription_id: any
	torrent_link: string
	tracker: any
	tracker_message: any
	type: string
	up_speed: number
	uploaded: number
}

interface User {
	account_active: boolean
	avatar_url: string
	can_create_sub_account: boolean
	days_until_files_deletion: number
	disk: {
		avail: number
		size: number
		used: number
	}
	download_token: string
	family_owner: string
	has_voucher: boolean
	is_sub_account: boolean
	mail: string
	oauth_token_id: number
	plan_expiration_date: string
	private_download_host_ip: any
	settings: Settings
	simultaneous_download_limit: number
	subtitle_languages: any[]
	user_id: number
	username: string
}

interface Settings {
	beta_user: boolean
	callback_url: any
	dark_theme: boolean
	default_download_folder: number
	fluid_layout: number
	history_enabled: number
	is_invisible: boolean
	locale: any
	login_mails_enabled: number
	next_episode: number
	pushover_token: any
	sort_by: string
	start_from: number
	subtitle_languages: any[]
	theater_mode: boolean
	transfer_sort_by: any
	trash_enabled: number
	tunnel_route_name: string
	use_private_download_ip: boolean
	video_player: any
}

interface Response {
	cursor: any
	download_links: string[]
	files: File[]
	info: User
	media_links: string[]
	mp4_links: string[]
	parent: File
	settings: Settings
	status: string
	total: number
	transfer: Transfer
	transfers: Transfer[]
}
