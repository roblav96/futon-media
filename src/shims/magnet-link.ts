import * as _ from 'lodash'
import { magnetDecode, magnetEncode, MagnetData } from '@ctrl/magnet-link'

export interface Magnet extends MagnetData {
	announce: string[]
	dn: string
	name: string
	tr: string[]
	xt: string
}

export function decode(magnet: string) {
	return magnetDecode(magnet) as Magnet
}

export function encode(magnet: Magnet) {
	return magnetEncode(magnet)
}

if (process.env.NODE_ENV == 'development') {
	process.nextTick(async () => _.defaults(global, await import('@/shims/magnet-link')))
}
