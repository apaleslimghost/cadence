import CodeMirror from 'codemirror'
import parinfer from 'parinfer-codemirror'
import compiler from '@cadence/compiler'

const cm = CodeMirror.fromTextArea(document.getElementById('editor'), {
    mode: 'text/x-common-lisp',
    tabSize: 3,
    indentWithTabs: true,
    autofocus: true,
    dragDrop: false,
})

parinfer.init(cm)

const output = document.getElementById('output')

cm.on('change', () => {
    output.innerHTML = JSON.stringify(compiler(cm.getValue()), null, 2)
})
