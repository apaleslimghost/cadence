import { type SExpr } from "s-expression";
type Scope = Record<string, unknown>;
type Specials = Record<string, (expr: SExpr, scope: Scope, specials: Specials) => any>;
declare const _default: (input: string, externals?: Scope, externalSpecials?: Specials) => unknown;
export default _default;
