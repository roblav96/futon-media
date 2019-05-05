import * as magneturi from 'magnet-uri'
import * as path from 'path'
import * as utils from '@/utils/utils'

export abstract class Debrid<Transfer = any> {
	abstract download(): Promise<string>
	abstract getFiles(): Promise<File[]>
	abstract streamUrl(file: File): Promise<string>

	files = [] as File[]
	protected dn: string
	protected infoHash: string
	protected magnet: string
	protected transfers: Transfer[]

	use(magnet: string) {
		this.magnet = magnet
		let { dn, infoHash } = magneturi.decode(this.magnet)
		Object.assign(this, { dn, infoHash: infoHash.toLowerCase() })
		return this
	}
}

export interface File {
	bytes: number
	id: number
	link: string
	name: string
	path: string
}
