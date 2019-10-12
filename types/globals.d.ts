type Dictionary<T = string> = Record<string, T>
type KeysOf<T> = (keyof T)[]
type AllPossibleKeys<T> = T extends any ? keyof T : never
type Obj2Keys<T> = { [K in keyof T]: K } & { [k: string]: never }
type PartialDeep<T> = { [P in keyof T]?: PartialDeep<T[P]> }
type Overwrite<T1, T2> = Pick<T1, Exclude<keyof T1, keyof T2>> & T2
type Constructor<T> = { new (...args: any[]): T }

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((
	k: infer I,
) => void)
	? I
	: never
type Unpacked<T> = T extends (infer U)[]
	? U
	: T extends (...args: any[]) => infer U
	? U
	: T extends Promise<infer U>
	? U
	: T
type UnPromise<T> = T extends Promise<infer U> ? U : T
type UnArray<T extends any[]> = T extends (infer U)[] ? U : T

type PartialDeeper<T> = {
	[P in keyof T]?: T[P] extends Array<infer U>
		? Array<PartialDeeper<U>>
		: T[P] extends ReadonlyArray<infer U>
		? ReadonlyArray<PartialDeeper<U>>
		: PartialDeeper<T[P]>
}

interface NodeModule {
	path: string
}
