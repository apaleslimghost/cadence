import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';

import App from './App.tsx'

import { registerAllModules } from 'handsontable/registry';
registerAllModules();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
