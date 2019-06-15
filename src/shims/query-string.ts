export * from 'query-string'
import * as qs from 'query-string'

export interface ParsedQuery {
	[key: string]: string
}
export function parse(query: string, options?: qs.ParseOptions) {
	return (qs.parse(query, options) as any) as ParsedQuery
}

export interface ParsedUrl {
	query: ParsedQuery
	url: string
}
export function parseUrl(url: string, options?: qs.ParseOptions) {
	return (qs.parseUrl(url, options) as any) as ParsedUrl
}
