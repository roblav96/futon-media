declare module 'stacktracey' {
	namespace StackTracey {
		interface Site {
			beforeParse: string;
			callee: string;
			calleeShort: string;
			column: number;
			file: string;
			fileName: string;
			fileRelative: string;
			fileShort: string;
			index: boolean;
			line: number;
			native: boolean;
			thirdParty: boolean;
		}
	}

	interface StackTracey extends Array<StackTracey.Site> {}

	class StackTracey {
		static extractEntryMetadata(...args: any[]): void;
		static from(p0?: any): any;
		static isArray(p0?: any): any;
		static isThirdParty(...args: any[]): void;
		static locationsEqual(...args: any[]): void;
		static of(): any;
		static rawParse(...args: any[]): void;
		static relativePath(...args: any[]): void;
		static resetCache(...args: any[]): void;
		static shortenPath(...args: any[]): void;
		static stack?: any;
		static withSource(...args: any[]): void;
		constructor(...args: any[]);
		at(index: number): StackTracey.Site;
		withSource(...args: any[]): void;
	}

	export = StackTracey;
}
