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
            'Shift-Up'() {
                const index = editors.indexOf(cm)
                if(index > 0) {
                    editors[index - 1].focus()
                }
            },
            'Shift-Down'() {
                const index = editors.indexOf(cm)
                if(index < editors.length - 1) {
                    editors[index + 1].focus()
                }
            }
        }
    })

    parinfer.init(cm)
    cm.on('change', compile)
    editors.push(cm)
}

createEditor()

