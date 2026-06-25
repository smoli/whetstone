// Render build/icon.svg → build/icon.raw.png using headless Electron (the only
// rasterizer available on this machine). Run: npx electron scripts/render-icon.cjs
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const buildDir = path.join(__dirname, '..', 'build')

app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(buildDir, 'icon.svg'), 'utf8')
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    useContentSize: true,
    frame: false,
    transparent: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: false },
  })
  const html =
    `<!doctype html><meta charset="utf-8">` +
    `<style>html,body{margin:0;padding:0;width:1024px;height:1024px;background:transparent}</style>` +
    svg
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 600))
  const image = await win.webContents.capturePage()
  fs.writeFileSync(path.join(buildDir, 'icon.raw.png'), image.toPNG())
  app.quit()
})
