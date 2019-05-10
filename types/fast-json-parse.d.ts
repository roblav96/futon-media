declare module 'fast-json-parse' {
	namespace parse {
		interface Parsed<T = any> {
			value: T
			err: Error
		}
	}
	function parse<T = any>(json: any): parse.Parsed<T>
	export = parse
}
