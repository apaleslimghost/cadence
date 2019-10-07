const parse = require('s-expression')

const defaultEnvironment = {}

const specials = {
    quote(tail) {
        return tail[0]
    },

    quasiquote: function quasiquote([expression], environment) {
        if(Array.isArray(expression)) {
            const [head, ...tail] = expression
            if(head === 'unquote') return eval(tail[0], environment)
            return expression.map(x => quasiquote([x], environment))
        }

        return expression
    },

    macro([name, argnames, body], environment) {
        environment[name] = (...args) => eval(eval(body, {
            ...environment,
            ...argnames.reduce(
                (env, name, index) => ({
                    ...env,
                    [name]: args[index]
                }),
                {}
            )
        }), environment)
    },

    if([condition, yes, no], environment) {
        return eval(condition, environment)
            ? eval(yes, environment)
            : eval(no, environment)
    },

    λ([argnames, body], environment) {
        return (...args) => eval(body, {
            ...environment,
            ...argnames.reduce(
                (env, name, index) => ({
                    ...env,
                    [name]: eval(args[index], environment)
                }),
                {}
            )
        })
    },

    def([name, value], environment) {
        return environment[name] = eval(value, environment)
    }
}

const serialise = expression => Array.isArray(expression)
      ? `(${expression.map(serialise).join(' ')})`
      : expression

const eval = (expression, environment) => {
    if(Array.isArray(expression)) {
        const [head, ...tail] = expression
        if(specials[head]) return specials[head](tail, environment)

        try {
            return eval(head, environment)(...tail)
        } catch(e) {
            if(e.message.startsWith('eval(')) {
                throw new Error(`${serialise(head)} is not a function`)
            }

            throw e
        }
    }

    if(expression instanceof String) return expression.valueOf()
    if(/^\d*(\.\d+)?$/.test(expression)) return parseFloat(expression)
    if(expression === 'nil') return false
    if(expression === 't') return true

    return environment[expression]
}


module.exports = source => {
    const expressions = parse('(' + source + ')')
    console.log(expressions)
    const environment = {...defaultEnvironment}
    return expressions.map(x => eval(x, environment))
}
