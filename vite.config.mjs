import {plugin as mdPlugin} from 'vite-plugin-markdown'
import wasm from 'vite-plugin-wasm'

export default {
  plugins: [
    mdPlugin({
      mode: 'html'
    }),
    wasm()
  ]
}
