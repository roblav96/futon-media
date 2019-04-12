// import * as http from 'http'
// import * as got from 'got'

// declare module 'got' {
// 	interface GotFn {
// 		defaults: {
// 			options: GotJSONOptions
// 		}
// 		extend(options: Partial<GotJSONOptions>): typeof got
// 		mergeOptions(aoptions: GotJSONOptions, boptions: Partial<GotJSONOptions>): GotJSONOptions
// 	}
// 	interface GotOptions<E extends string | null> {
// 		mutableDefaults?: boolean
// 		resolveBodyOnly?: boolean
// 		searchParams?: string | Record<string, string | number> | URLSearchParams
// 	}
// 	interface Hooks<Options, Body extends Buffer | string | object> {
// 		init?: InitHook<Options>[]
// 		beforeError?: BeforeErrorHook[]
// 	}
// 	type InitHook<Options> = (options: Options) => any
// 	type BeforeErrorHook = (error: GotError) => GotError
// 	// interface Response<B extends Buffer | string | object> extends http.IncomingMessage {
// 	// 	body: any
// 	// }
// }
