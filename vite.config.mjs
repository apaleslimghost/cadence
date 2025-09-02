import {plugin as mdPlugin} from 'vite-plugin-markdown'

export default {
  plugins: [mdPlugin({
	mode: 'html'
  })]
}
