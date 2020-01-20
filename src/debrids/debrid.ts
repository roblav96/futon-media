import * as magnetlink from '@/shims/magnet-link'
import * as parser from '@/scrapers/parser'

export abstract class Debrid {
	abstract download(): Promise<boolean>
	abstract getFiles(): Promise<File[]>
	abstract streamUrl(file: File, original: boolean): Promise<string>

	protected dn: string
	protected infoHash: string

	constructor(public magnet: string) {
		let decoded = magnetlink.decode(magnet)
		this.dn = decoded.dn
		this.infoHash = decoded.infoHash.toLowerCase()
	}
}

export interface File {
	bytes: number
	id: number
	levens: number
	mkv: string
	mp4: string
	name: string
	parsed: parser.Parser
	path: string
}
