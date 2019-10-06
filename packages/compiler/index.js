const parse = require('s-expression')

const defaultEnvironment = {}

const quasiquote = (expression, environment) => {
    if(Array.isArray(expression)) {
        const [head, ...tail] = expression
        if(head === 'unquote') return eval(tail[0], environment)
        return expression.map(x => quasiquote(x, environment))
    }

    return expression
}

const macro = ([name, argnames, body], environment) => {
    environment[name] = (...args) => eval(body, {
        ...environment,
        ...argnames.reduce(
            (env, name, index) => ({
                ...env,
                [name]: args[index]
            }),
            {}
        )
    })
}

const serialise = expression => Array.isArray(expression)
      ? `(${expression.map(serialise).join(' ')})`
      : expression

const eval = (expression, environment) => {
    if(Array.isArray(expression)) {
        const [head, ...tail] = expression
        if(head === 'quote') return tail[0]
        if(head === 'quasiquote') return quasiquote(tail[0], environment)
        if(head === 'macro') return macro(tail, environment)

        try {
            return eval(head, environment).apply(environment, tail.map(expr => eval(expr, environment)))
        } catch(e) {
            throw new Error(`${serialise(head)} is not a function`)
        }
    }

    if(/^\d*(\.\d+)?$/.test(expression)) return parseFloat(expression)
    if(expression instanceof String) expression.valueOf()

    return environment[expression]
}


module.exports = source => {
    const expressions = parse('(' + source + ')')
    console.log(expressions)
    const environment = {...defaultEnvironment}
    return expressions.map(x => eval(x, environment))
}
