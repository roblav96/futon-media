import * as _ from 'lodash'
import * as http from '../adapters/http'

export interface Debrid {
	check(hashes: string[]): Promise<boolean[]>
}
export class Debrid {}

export { realdebrid } from '@/debrids/realdebrid'
export { premiumize } from '@/debrids/premiumize'
