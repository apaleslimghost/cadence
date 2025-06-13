declare module "s-expression" {
	export type Atom = string | String | SExpr
	export type SExpr = Atom[]
	class SParser {
		static not_whitespace_or_end: RegExp
		static space_quote_paren_escaped_or_end: RegExp
		static string_or_escaped_or_end: RegExp
		static string_delimiters: RegExp
		static quotes: RegExp
		static quotes_map: Record<string, string>
	}

	const parse: ((input: string) => SExpr | Error) & {
		Parser: typeof SParser
	}

	export default parse
}
