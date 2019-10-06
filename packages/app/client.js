import CodeMirror from 'codemirror'
import parinfer from 'parinfer-codemirror'
import compiler from '@cadence/compiler'

const output = document.getElementById('output')
const editor = document.getElementById('editor')
const editors = []

function compile() {
    output.innerHTML = JSON.stringify(
        editors.map(editor => compiler(editor.getValue())),
        null, 2
    )
}

function createEditor() {
    const cm = CodeMirror(editor, {
        mode: 'text/x-common-lisp',
        tabSize: 3,
        indentWithTabs: true,
        autofocus: true,
        dragDrop: false,
        extraKeys: {
            'Shift-Enter': createEditor,
        }
    })

    parinfer.init(cm)
    cm.on('change', compile)
    editors.push(cm)
}

createEditor()

