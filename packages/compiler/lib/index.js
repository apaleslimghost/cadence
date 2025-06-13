import parse from "s-expression";
const DEBUG = false;
parse.Parser.quotes = /['`,←]/;
parse.Parser.quotes_map = {
    ...parse.Parser.quotes_map,
    '←': 'subscribe'
};
const defaultSpecials = {
    quote(tail) {
        return tail[0];
    },
    quasiquote([expression], scope, specials) {
        if (Array.isArray(expression)) {
            const [head, ...tail] = expression;
            if (head === "unquote")
                return evaluate(tail[0], scope, specials);
            return expression.map(x => specials.quasiquote([x], scope, specials));
        }
        return expression;
    },
    if([condition, yes, no], scope, specials) {
        return evaluate(condition, scope, specials)
            ? evaluate(yes, scope, specials)
            : evaluate(no, scope, specials);
    },
    λ([argnames, body], scope, specials) {
        if (!(typeof name === 'string'))
            throw new Error('macro name must be a string');
        if (!Array.isArray(argnames) || !argnames.every(arg => typeof arg === 'string'))
            throw new Error('argnames must be a bare list of strings');
        return (...args) => evaluate(body, {
            ...scope,
            ...argnames.reduce((env, name, index) => ({
                ...env,
                [name]: evaluate(args[index], scope, specials),
            }), {}),
        }, specials);
    },
    def([name, value], scope, specials) {
        if (!(typeof name === 'string'))
            throw new Error('name must be a string');
        return scope[name] = evaluate(value, scope, specials);
    },
    do(exprs, scope, specials) {
        let returnVal;
        for (const expr of exprs) {
            returnVal = evaluate(expr, scope, specials);
        }
        return returnVal;
    },
};
const serialise = (expression) => Array.isArray(expression)
    ? `(${expression.map(serialise).join(" ")})`
    : expression.valueOf();
const evaluate = (expression, scope, specials) => {
    if (Array.isArray(expression)) {
        const [head, ...tail] = expression;
        if (typeof head === 'string' && specials[head])
            return specials[head](tail, scope, specials);
        const fn = evaluate(head, scope, specials);
        if (typeof fn !== 'function') {
            throw new Error(`${serialise(head)} is not a function`);
        }
        return fn(...tail.map(expr => evaluate(expr, scope, specials)));
    }
    if (DEBUG)
        console.log("RETURN", serialise(expression), expression, typeof expression);
    if (expression instanceof String)
        return expression.valueOf();
    if (/^\d*(\.\d+)?$/.test(expression))
        return parseFloat(expression);
    if (typeof expression === "string")
        return scope[expression];
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
export default (input, externals = {}, externalSpecials = {}) => {
    const tree = parse(input);
    if (tree instanceof Error)
        throw tree;
    return evaluate(tree, { ...defaultScope, ...externals }, { ...defaultSpecials, ...externalSpecials });
};
