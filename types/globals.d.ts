type PartialDeep<T> = { [P in keyof T]?: PartialDeep<T[P]> }
// type PartialDeep<T> = {
// 	[P in keyof T]?: T[P] extends Array<infer U>
// 		? Array<PartialDeep<U>>
// 		: T[P] extends ReadonlyArray<infer U>
// 		? ReadonlyArray<PartialDeep<U>>
// 		: PartialDeep<T[P]>
// }
