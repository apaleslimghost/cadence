import CodeMirror from 'codemirror'
import parinferCodeMirror from 'parinfer-codemirror'
import compiler from '@cadence/compiler'

const output = document.getElementById('output')
const editor = document.getElementById('editor')
const contents = new Map()

function compile() {
    output.innerHTML = JSON.stringify(
        Array.from(contents.values(), compiler),
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

    parinferCodeMirror.init(cm, 'indent')
    cm.on('change', () => {
        contents.set(cm, cm.getValue())
        requestAnimationFrame(compile)
    })
}

createEditor()

