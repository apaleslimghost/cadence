const compiler = require('./')
const util = require('util')

test('compiler', () => {
    console.log(util.inspect(compiler(`'(1 2 3)`), {depth: null}))
})
