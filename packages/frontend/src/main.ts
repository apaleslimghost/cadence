import './index.css'
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

import Handsontable from 'handsontable';
import { textRenderer } from 'handsontable/renderers';
import { registerAllModules } from 'handsontable/registry';
registerAllModules();

Handsontable.cellTypes.registerCellType('lisp', {
  renderer(instance, td, row, column, prop, value, cellProps) {
    return textRenderer(instance, td, row, column, prop, 'todo', cellProps)
  },
});

const root = document.getElementById('root')!

new Handsontable(root, {
      className: "ht-theme-main-dark-auto",
      cells: () => ({ type: 'lisp' }),
      minCols: 100,
      minRows: 100,
      colWidths: 200,
      rowHeaders: true,
      colHeaders: true,
      height: "100%",
      width: "100%",
      autoWrapRow: true,
      autoWrapCol: true,
      autoRowSize: false,
      autoColumnSize: false,
      afterChange: (changes) => {
        for(const [row, col, oldValue, newValue] of changes ?? []) {
          console.log({ row, col, oldValue, newValue })
        }
      },
      licenseKey: "non-commercial-and-evaluation"
})
