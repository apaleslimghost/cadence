const { app, BrowserWindow } = require('electron')

app.on('ready', () => {
    const window = new BrowserWindow({
        titleBarStyle: 'hidden'
    })

    window.loadURL('http://localhost:1234')
})
