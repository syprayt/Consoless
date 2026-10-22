# Consoless

A friendly graphical command line for everyday work on a computer — and for ordinary tasks on a home router.

Consoless turns the commands already installed on the machine into ordinary icons. You can search, sort, and run the safe ones with buttons instead of typing. The same app runs on **macOS**, **Windows**, and **Linux**. Routers are added over SSH with a key; the password is never stored.

## What it does

- Discovers commands from `PATH` (and shell builtins where they exist)
- Shows known commands with icons; everything else gets a letter mark
- Lets you search and sort; **Popular** is the calm default view
- Reads **About this device** for this computer (and for a saved router)
- Runs everyday file actions with a picker — only inside your user folder
- Asks before delete, router restart, or OpenWrt factory reset (Cancel is the default)
- On a router: fixed actions such as **Who is connected**, restart, and reset — no free remote shell

## Download

Installers are built into the `release/` folder (not committed to git):

| Platform | File |
| --- | --- |
| macOS (Apple Silicon) | `Consoless-0.1.0-arm64.dmg` |
| macOS (Intel) | `Consoless-0.1.0.dmg` |
| Windows | `Consoless-Setup-0.1.0.exe` |
| Linux | `Consoless-0.1.0.AppImage` or `consoless_0.1.0_amd64.deb` |

On macOS and Windows the first launch may ask for confirmation because the builds are not Apple-notarized or Windows-signed yet.

## Develop

Needs **Node.js 20+**.

```bash
npm install
npm start
```

That opens the desktop window with Vite for the UI. The UI language is English.

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm start` | Dev window (Vite + Electron) |
| `npm run build` | Typecheck, UI build, Electron bundle |
| `npm run icon` | Rebuild `build/icon.png` |
| `npm run pack` | Icon + build + macOS / Windows / Linux installers |

## Safety notes

- Commands run without a shell; paths are not glued into a command string
- Destructive file actions stay inside the home folder and need a native confirmation
- Router access uses SSH `BatchMode` (keys only); saved routers live in the app user data folder, not in this repository

## Project layout

```
electron/   Desktop window and IPC
server/     Catalog, about-readers, router SSH
shared/     Policy, paths, device helpers
src/        React UI
scripts/    Electron bundle and app icon
```

## License

MIT
