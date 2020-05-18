declare module 'benchmarkify' {
	namespace Benchmarkify {
		interface Options {
			logger: Console
			spinner: boolean
		}
		interface SuiteOptions {
			cycles: number
			minSamples: number
			time: number
		}
		interface Result {
			fastest: boolean
			name: string
			stat: {
				avg: number
				count: number
				cycle: number
				duration: number
				percent: number
				rps: number
			}
		}
		class Suite {
			constructor(parent: Benchmarkify, name: string, opts: SuiteOptions)
			add(name: string, fn: (done?: () => void) => void): this
			only(name: string, fn: (done?: () => void) => void): this
			ref(name: string, fn: (done?: () => void) => void): this
			skip(name: string, fn: (done?: () => void) => void): this
			run(): Promise<Result[]>
		}
	}
	class Benchmarkify {
		constructor(name?: string, opts?: Partial<Benchmarkify.Options>)
		createSuite(name: string, opts?: Partial<Benchmarkify.SuiteOptions>): Benchmarkify.Suite
		printHeader(platformInfo?: boolean): this
		printPlatformInfo(): void
		run(suites: Benchmarkify.Suite[]): Promise<Benchmarkify.Result[]>
	}
	export = Benchmarkify
}
