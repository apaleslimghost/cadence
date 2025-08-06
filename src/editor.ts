
import Handsontable from 'handsontable';
import {EditorView, minimalSetup} from 'codemirror'
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import {bracketMatching, HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import { Cadence } from './lang/codemirror';
import { tags as t } from '@lezer/highlight';
import c from './palette'

let instance: CodeMirrorEditor

const theme = HighlightStyle.define([
	{ tag: t.paren, color: c.steel[5] },
	{ tag: t.function(t.variableName), color: c.apple[5] },
	{ tag: t.string, color: c.lemon[8] },
	{ tag: t.number, color: c.violet[7] },
])

// - [x] deleting a cell spawns an empty unfocused editor in that cell
// - [ ] enter shortcut doesn't work in an editor created by typing instead of doubleclicking
// - [ ] shouldn't autoclose single quotes
// - [ ] highlighting for:
//   - [ ] function calls
//   - [ ] operator-like functions
//   - [ ] numbers
//   - [ ] symbols/other quoted expressions
//   - [ ] numbers


export default class CodeMirrorEditor extends Handsontable.editors.BaseEditor {
	editor: EditorView
	wrapper: HTMLDivElement

	constructor(hot: Handsontable) {
		super(hot)
		this.wrapper = this.hot.rootDocument.createElement('div')
		this.editor = new EditorView({
			extensions: [
				minimalSetup,
				closeBrackets(),
				bracketMatching(),
				syntaxHighlighting(theme),
				Cadence(),
				Prec.high(keymap.of(closeBracketsKeymap)),
				Prec.highest(keymap.of([{
					key: 'Enter',
					run: (view) => {
						console.log('enter')
						this.finishEditing()
						return true
					}
				}, {
					key: 'Escape',
					run: (view) => {
						this.finishEditing(true)
						return true
					}
				}]))
			],
			parent: this.wrapper
		})

		this.wrapper.classList.add('htCodemirror')
		this.wrapper.style.display = 'none'
		this.hot.rootElement.appendChild(this.wrapper)


		this.hot.addHook('afterScrollHorizontally', () => this.refreshDimensions());
		this.hot.addHook('afterScrollVertically', () => this.refreshDimensions());
	}

	refreshDimensions() {
		const rect = this.getEditedCellRect()
		if(!rect) return

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
	}

	open() {
		this.refreshDimensions()
		this.wrapper.style.display = '';

		this.editor.focus()
		this.editor.dispatch({
			selection: {
				anchor: this.getValue().length,
				head: this.getValue().length,
			}
		})

		this.hot.getShortcutManager().setActiveContextName('editor')
	}

	getValue() {
		return this.editor?.state.doc.toString()
	}

	refreshValue() {
		const physicalRow = this.hot.toPhysicalRow(this.row);
		const sourceData = this.hot.getSourceDataAtCell(physicalRow, this.col);

		this.originalValue = sourceData;

		this.setValue(sourceData);
		this.refreshDimensions();
	}

	setValue(newValue?: any) {
		this.editor.dispatch({
			changes: [{
				from: 0,
				to: this.editor.state.doc.length,
				insert: newValue
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
