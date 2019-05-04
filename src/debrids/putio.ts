import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as http from '@/adapters/http'
import * as magneturi from 'magnet-uri'
import * as pAll from 'p-all'
import * as path from 'path'
import * as utils from '@/utils/utils'
import { RealDebrid } from '@/debrids/realdebrid'

export const client = new http.Http({
	baseUrl: 'https://api.put.io/v2',
	headers: {
		authorization: `token ${process.env.PUTIO_TOKEN}`,
	},
})

export class Putio extends debrid.Debrid<Item> {
	static async cached(hashes: string[]) {
		return hashes.map(v => false)
	}
	
	async download() {}

	async getFiles() {}

	async streamUrl(file: debrid.File) {}
}

interface File {
	content_type: string
	crc32: any
	created_at: string
	extension: any
	file_type: string
	first_accessed_at: any
	folder_type: string
	icon: string
	id: number
	is_hidden: boolean
	is_mp4_available: boolean
	is_shared: boolean
	name: string
	opensubtitles_hash: any
	parent_id: any
	screenshot: any
	size: number
	updated_at: string
}

interface FilesResponse {
	cursor: any
	files: File[]
	parent: File
	status: string
	total: number
}
