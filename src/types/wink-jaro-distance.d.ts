declare module 'wink-jaro-distance' {
	namespace jaro {}
	function jaro(a: string, b: string): { distance: number; similarity: number };
	export = jaro;
}
