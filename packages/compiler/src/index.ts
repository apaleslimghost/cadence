import parse from "s-expression";

const DEBUG = false;

const specials = {
  quote(tail) {
    return tail[0];
  },

  quasiquote: function quasiquote([expression], scope) {
    if (Array.isArray(expression)) {
      const [head, ...tail] = expression;
      if (head === "unquote") return evaluate(tail[0], scope, "quasi unquote");
      return expression.map(x => quasiquote([x], scope));
    }

    return expression;
  },

  macro([name, argnames, body], scope) {
    scope[name] = (...args) =>
      evaluate(
        evaluate(body, {
          ...scope,
          ...argnames.reduce(
            (env, name, index) => ({
              ...env,
              [name]: args[index],
            }),
            {},
          ),
        }, "macro body"),
        scope,
        "macro result",
      );
  },

  if([condition, yes, no], scope) {
    return evaluate(condition, scope, "if condition")
      ? evaluate(yes, scope, "if true body")
      : evaluate(no, scope, "if false body");
  },

  λ([argnames, body], scope) {
    return (...args) =>
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
    const val = evaluate(value, scope, "def");
    if (DEBUG) console.log("DEF", name, val, scope);

    return scope[name] = val;
  },

  do(exprs, scope) {
    let returnVal;
    for (const expr of exprs) {
      returnVal = evaluate(expr, scope, "do");
    }
    return returnVal;
  },
};

const serialise = expression =>
  Array.isArray(expression)
    ? `(${expression.map(serialise).join(" ")})`
    : expression;

const evaluate = (expression, scope, debug) => {
  if (DEBUG) console.log("EVAL", serialise(expression), scope, debug);
  if (Array.isArray(expression)) {
    const [head, ...tail] = expression;
    if (specials[head]) return specials[head](tail, scope);

    const fn = evaluate(head, scope, "function");
    if (!fn) {
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

const defaultScope = {
  p: (...args) => (console.log(...args), args),
  nil: false,
  t: true,
  "*": (...args) => args.reduce((a, b) => a * b),
  "+": (...args) => args.reduce((a, b) => a + b),
  "-": (a, b) => a - b,
  "/": (a, b) => a / b,
  ">": (a, b) => a > b,
  "<": (a, b) => a < b,
  ">=": (a, b) => a >= b,
  "<=": (a, b) => a <= b,
};
