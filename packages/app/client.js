import CodeMirror from 'codemirror'
import 'codemirror/addon/mode/simple'
import parinferCodeMirror from 'parinfer-codemirror'
import compiler from '@cadence/compiler'

CodeMirror.defineSimpleMode('cadence', {
    start: [
        {regex: /"(?:[^"]|(?<=\\)")*"/, token: 'string'},
        {regex: /(\()(macro|defun)( )(\S+)/, token: [null, 'keyword', null, 'attribute']},
        {regex: /(\()(λ|if|def)( )/, token: [null, 'keyword', null]},
    ]
})

const output = document.getElementById('output')
const editor = document.getElementById('editor')
const contents = new Map()

function compile() {
    output.innerHTML = JSON.stringify(
        Array.from(contents.values(), ({version, revisions}) => {
            try {
                return compiler(revisions[version])
            } catch(e) {
                return e.message
            }
        }),
        null, 2
    )
}

function createEditor() {
    const cm = CodeMirror(editor, {
        mode: 'cadence',
        theme: 'monokai',
        tabSize: 3,
        indentWithTabs: true,
        autofocus: true,
        dragDrop: false,
        lineWrapping: true,
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
            },
            'Cmd-R'() {
                const { revisions } = contents.get(cm)
                const version = revisions.push(cm.getValue())
                contents.set(cm, { version, revisions })
            }
        }
    })

    contents.set(cm, {
        version: 0,
        revisions: []
    })

    parinferCodeMirror.init(cm, 'indent')
    cm.on('change', () => {
        const { version, revisions } = contents.get(cm)
        revisions[version] = cm.getValue()
        contents.set(cm, { version, revisions })
        requestAnimationFrame(compile)
    })
}

createEditor()

