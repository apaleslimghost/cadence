const { parse } = require('sexpr-plus')
const { produce } = require('immer')

const walk = expressions => expressions.reduce(
    produce((environment, expression) => {
        switch(expression.type) {
            case 'list': {
                const [head, ...tail] = expression.content
                if(head.type === 'atom') {
                    return environment[head.content](...tail)
                }
            }
        }

        return []
    }),
    {
        quote({ content }) {
            return content
        }
    }
)

module.exports = source => walk(parse(source))
