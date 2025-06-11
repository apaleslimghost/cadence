declare module "s-expression" {
	export type Atom = string | String | SExpr
	export type SExpr = Atom[]
	export default function parse(input: string): SExpr | Error
}
