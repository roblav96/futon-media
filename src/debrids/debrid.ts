import * as _ from 'lodash'
import * as http from '../adapters/http'

export interface Debrid {
	checkCache(hashes: string[]): Promise<boolean[]>
}
export class Debrid {
	
}
