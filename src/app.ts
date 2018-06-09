import { app, BrowserWindow, globalShortcut } from 'electron';

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});

app.on('ready', () => {
    const mainWindow = new BrowserWindow({width: 1100, height: 720});
    mainWindow.loadURL('file://' + __dirname + '/index.html');
    mainWindow.setMenuBarVisibility(false);
});
