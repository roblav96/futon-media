import * as _ from 'lodash'
import * as http from '@/adapters/http'
import { realdebrid } from '@/debrids/realdebrid'
import { premiumize } from '@/debrids/premiumize'

export interface Debrid {
	getCached(hashes: string[]): Promise<boolean[]>
	// download(magnet: string): Promise<void>
	links(magnet: string): Promise<string[]>
}

export const debrids = { realdebrid, premiumize }
export const entries = Object.entries(debrids)

export async function getCached(hashes: string[]) {
	let resolved = await Promise.all(entries.map(([k, v]) => v.getCached(hashes)))
	return hashes.map((v, index) => {
		return entries.map(([key], i) => resolved[i][index] && key).filter(Boolean)
	}) as Debrids[][]
}

export type Debrids = keyof typeof debrids
