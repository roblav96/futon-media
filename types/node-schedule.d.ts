import * as schedule from 'node-schedule'

declare module 'node-schedule' {
	export interface Job {
		invoke(...args): void
	}
}
