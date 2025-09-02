import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import './index.css';
import colours from './palette'

import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';

import * as Tone from 'tone'

import renderer from './renderer';
import { runCell } from './store';
import CodeMirrorEditor from './editor';

import * as readme from '../README.md'

registerAllModules();

const root = document.getElementById('root')!
const docs = document.getElementById('docs')!
const close = document.getElementById('close')!
const icon = document.querySelector('link[rel=icon]')!

if(localStorage.neverShowDocs) {
  docs.remove()
} else {
  docs.insertAdjacentHTML('beforeend', readme.html)
  docs.querySelector('img[src="etc/icon.png"]')!.setAttribute('src', icon.getAttribute('href')!) // lolsob

  close.addEventListener('click', () => {
    docs.remove()
    if(confirm('close docs forever?')) {
      localStorage.neverShowDocs = true
    }
  })
}

const hot = new Handsontable(root, {
  className: "ht-theme-main-dark",
  data: [[]],
  renderer,
  editor: CodeMirrorEditor,
  minCols: 20,
  minRows: 100,
  colWidths: 200,
  rowHeaders: true,
  colHeaders: true,
  height: "100%",
  width: "100%",
  autoRowSize: false,
  autoColumnSize: false,
  wordWrap: false,
  persistentState: true,
  afterInit(this: Handsontable) {
    const loaded = { value: undefined }
    this.getPlugin('persistentState').loadValue('tableData', loaded)
    const data = loaded.value ?? [[]]
    this.updateData(data)
    for(const [rowNum, col] of data.entries()) {
      for(const [colNum, cell] of col.entries()) {
        runCell(colNum, rowNum, cell)
      }
    }
  },
  afterChange(this: Handsontable, changes, source) {
    if (source !== 'loadData' && source !== 'updateData') {
      this.getPlugin('persistentState').saveValue('tableData', this.getData())
    }

    for(const [row, column, oldValue, newValue] of changes ?? []) {
      if(oldValue === newValue) return

      runCell(column as number, row, newValue)
    }
  },
  licenseKey: "non-commercial-and-evaluation"
})

root.addEventListener('click', async () => {
  await Tone.start()
  root.classList.remove('pending')
  hot.selectCell(0, 0)
})
