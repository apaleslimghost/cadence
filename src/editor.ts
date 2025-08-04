
import Handsontable from 'handsontable';
import {EditorView, minimalSetup} from 'codemirror'

let instance: CodeMirrorEditor

export default class CodeMirrorEditor extends Handsontable.editors.BaseEditor {
	editor: EditorView
	wrapper: HTMLDivElement

	constructor(hot: Handsontable) {
		super(hot)
		this.wrapper = this.hot.rootDocument.createElement('div')
		this.editor = new EditorView({
			extensions: [minimalSetup],
			parent: this.wrapper
		})

		this.wrapper.classList.add('htCodemirror')
		this.wrapper.style.display = 'none'
		this.hot.rootElement.appendChild(this.wrapper)
	}

	open() {
		const rect = this.getEditedCellRect()
		if(!rect || !this.wrapper) return

		const {
			top,
			start,
			width,
			height,
		} = rect

		this.wrapper.style.height = `${height}px`
		this.wrapper.style.minWidth = `${width}px`;
		this.wrapper.style.top = `${top}px`;
		this.wrapper.style[this.hot.isRtl() ? 'right' : 'left'] = `${start}px`;
		this.wrapper.style.margin = '0px';
		this.wrapper.style.display = '';

		this.editor.focus()
		this.editor.dispatch({
			selection: {
				anchor: this.getValue().length,
				head: this.getValue().length,
			}
		})
	}

	getValue() {
		return this.editor?.state.doc.toString()
	}

	setValue(newValue?: any) {
		if(!this.editor) return

		this.editor.dispatch({
			changes: [{
				from: 0,
				to: this.editor.state.doc.length,
				invert: newValue
			}]
		})
	}

	focus() {
		this.editor?.focus()
	}

	close() {
		if(this.wrapper) this.wrapper.style.display = 'none';
	}
}
