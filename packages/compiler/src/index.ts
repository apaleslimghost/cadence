import parse, { Atom, type SExpr } from "s-expression";

const DEBUG = false;

type Scope = Record<string, unknown>

const specials: Record<string, (expr: SExpr, scope: Scope) => any> = {
  quote(tail) {
    return tail[0];
  },

  quasiquote([expression], scope) {
    if (Array.isArray(expression)) {
      const [head, ...tail] = expression;
      if (head === "unquote") return evaluate(tail[0], scope, "quasi unquote");
      return expression.map(x => specials.quasiquote([x], scope));
    }

    return expression;
  },

  if([condition, yes, no], scope) {
    return evaluate(condition, scope, "if condition")
      ? evaluate(yes, scope, "if true body")
      : evaluate(no, scope, "if false body");
  },

  λ([argnames, body], scope) {
    if(!(typeof name === 'string')) throw new Error('macro name must be a string')
    if(!Array.isArray(argnames) || ! argnames.every(
      arg => typeof arg === 'string'
    )) throw new Error('argnames must be a bare list of strings')

    return (...args: SExpr[]) =>
      evaluate(body, {
        ...scope,
        ...argnames.reduce(
          (env, name, index) => ({
            ...env,
            [name]: evaluate(args[index], scope, `function scope ${name}`),
          }),
          {},
        ),
      }, "function body");
  },

  def([name, value], scope) {
    if(!(typeof name === 'string')) throw new Error('name must be a string')

    return scope[name] = evaluate(value, scope, "def");
  },

  do(exprs, scope) {
    let returnVal;
    for (const expr of exprs) {
      returnVal = evaluate(expr, scope, "do");
    }
    return returnVal;
  },
};

const serialise = (expression: Atom): string =>
  Array.isArray(expression)
    ? `(${expression.map(serialise).join(" ")})`
    : expression.valueOf();

const evaluate = (expression: Atom, scope: Scope, debug?: string): unknown => {
  if (DEBUG) console.log("EVAL", serialise(expression), scope, debug);
  if (Array.isArray(expression)) {
    const [head, ...tail] = expression;
    if (typeof head === 'string' && specials[head]) return specials[head](tail, scope);

    const fn = evaluate(head, scope, "function");
    if (typeof fn !== 'function') {
      throw new Error(`${serialise(head)} is not a function`);
    }

    return fn(...tail.map(expr => evaluate(expr, scope, "function arg")));
  }

  if (DEBUG) console.log("RETURN", serialise(expression), expression, typeof expression);

  if (expression instanceof String) return expression.valueOf();
  if (/^\d*(\.\d+)?$/.test(expression)) return parseFloat(expression);
  if (typeof expression === "string") return scope[expression];
  return expression;
};

const cells = [];

const defaultScope: Scope = {
  p: (...args: unknown[]) => (console.log(...args), args),
  nil: false,
  t: true,
  "*": (...args: number[]) => args.reduce((a, b) => a * b),
  "+": (...args: number[]) => args.reduce((a, b) => a + b),
  "-": (a: number, b: number) => a - b,
  "/":  (a: number, b: number) => a / b,
  ">":  (a: any, b: any) => a > b,
  "<":  (a: any, b: any) => a < b,
  ">=":  (a: any, b: any) => a >= b,
  "<=":  (a: any, b: any) => a <= b,
};

export default (input: string) => {
  const tree = parse(input)
  if(tree instanceof Error) throw tree
  return evaluate(tree, defaultScope, 'root')
}
