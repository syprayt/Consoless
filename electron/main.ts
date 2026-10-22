import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseChoice } from "../shared/device"
import { parseRouterChoice, parseRouterDraft, type RouterRecord } from "../shared/router"
import { readComputer } from "../server/about"
import { buildCatalog, describeCommand, runCommand } from "../server/catalog"
import { readRouter, routerCatalog, routerDevices, routerPower, suggestGateway } from "../server/router"
import type { Catalog } from "../shared/types"

const here = path.dirname(fileURLToPath(import.meta.url))
let cache: Catalog | null = null

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 860,
    minHeight: 640,
    title: "Consoless",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#e7e4de",
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (app.isPackaged) {
    void window.loadFile(path.join(app.getAppPath(), "dist", "index.html"))
  } else {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173")
  }
}

app.setName("Consoless")
if (process.platform === "win32") app.setAppUserModelId("com.consoless.app")

app.whenReady().then(() => {
  if (process.platform !== "darwin") Menu.setApplicationMenu(null)

  ipcMain.handle("catalog", (_event, refresh: boolean) => {
    if (!cache || refresh) cache = buildCatalog()
    return cache
  })

  ipcMain.handle("detail", (_event, name: string) => ({ name, ...describeCommand(name) }))

  ipcMain.handle("computer", (_event, choice: unknown) => readComputer(parseChoice(choice)))

  ipcMain.handle("routers", () => readRouters())

  ipcMain.handle("gateway", () => suggestGateway())

  ipcMain.handle("router-save", async (_event, draft: unknown) => {
    const parsed = parseRouterDraft(draft)
    if ("error" in parsed) return { error: parsed.error }
    const routers = readRouters()
    if (routers.some((item) => item.host === parsed.draft.host && item.user === parsed.draft.user && item.port === parsed.draft.port)) {
      return { error: "That router is already in the list." }
    }
    const router: RouterRecord = { id: `router-${Date.now().toString(36)}`, choice: "auto", ...parsed.draft }
    const reached = await readRouter(router)
    if (reached.notice) return { error: reached.notice }
    writeRouters([...routers, router])
    return { router }
  })

  ipcMain.handle("router-forget", (_event, id: unknown) => {
    if (typeof id !== "string") return
    writeRouters(readRouters().filter((item) => item.id !== id))
  })

  ipcMain.handle("router-choice", (_event, payload: { id?: unknown; choice?: unknown }) => {
    const choice = parseRouterChoice(payload?.choice)
    writeRouters(readRouters().map((item) => (item.id === payload?.id ? { ...item, choice } : item)))
  })

  ipcMain.handle("router-catalog", (_event, id: unknown) => {
    const router = findRouter(id)
    if (!router) throw new Error("That router is no longer in the list.")
    return routerCatalog(router)
  })

  ipcMain.handle("router-computer", (_event, id: unknown) => {
    const router = findRouter(id)
    if (!router) throw new Error("That router is no longer in the list.")
    return readRouter(router)
  })

  ipcMain.handle("router-devices", (_event, id: unknown) => {
    const router = findRouter(id)
    if (!router) return { error: "That router is no longer in the list." }
    return routerDevices(router)
  })

  ipcMain.handle("router-power", async (event, payload: { id?: unknown; action?: unknown }) => {
    const router = findRouter(payload?.id)
    const action = payload?.action === "reset" ? "reset" : payload?.action === "restart" ? "restart" : ""
    if (!router || !action) return { ok: false, code: 1, stdout: "", stderr: "", timedOut: false, argv: [], error: "That router is no longer in the list." }
    const confirmed = await confirmRouter(BrowserWindow.fromWebContents(event.sender), router.name, action)
    if (!confirmed) {
      return { ok: false, code: 1, stdout: "", stderr: "", timedOut: false, argv: [action], error: action === "reset" ? "Reset cancelled." : "Restart cancelled." }
    }
    return routerPower(router, action)
  })

  ipcMain.handle("pick", async (event, request: { kind: "file" | "folder" | "either"; multiple?: boolean; directory?: string }) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    const properties: Array<"openFile" | "openDirectory" | "multiSelections"> = []
    if (request.kind !== "folder") properties.push("openFile")
    if (request.kind !== "file") properties.push("openDirectory")
    if (request.multiple) properties.push("multiSelections")
    const directory = request.directory
    const defaultPath = dialogStart(directory)
    const options = { title: "Choose", properties, defaultPath }
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    if (result.canceled) return []
    const { statSync } = await import("node:fs")
    return result.filePaths.map((filePath) => {
      let directory = false
      try {
        directory = statSync(filePath).isDirectory()
      } catch {
        directory = false
      }
      return { path: filePath, directory }
    })
  })

  ipcMain.handle("run", async (event, payload: { name?: string; args?: string[] }) => {
    if (!cache) cache = buildCatalog()
    const name = payload.name ?? ""
    const args = payload.args ?? []
    if (name === "rm" || name === "rmdir") {
      const confirmed = await confirmDelete(BrowserWindow.fromWebContents(event.sender), name, args)
      if (!confirmed) {
        return {
          ok: false,
          code: 1,
          stdout: "",
          stderr: "",
          timedOut: false,
          argv: [name, ...args],
          error: "Delete cancelled.",
        }
      }
    }
    return runCommand(cache, name, args)
  })

  createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  app.quit()
})

function dialogStart(directory: unknown): string | undefined {
  if (typeof directory !== "string" || directory.includes("\0") || directory.split(/[/\\]/).includes("..")) return undefined
  if (directory.startsWith("/") || /^[A-Za-z]:[\\/]/.test(directory)) return directory
  return undefined
}

function routersPath(): string {
  return path.join(app.getPath("userData"), "routers.json")
}

function readRouters(): RouterRecord[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(routersPath(), "utf8")) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      const draft = parseRouterDraft(item)
      if ("error" in draft || typeof item !== "object" || item === null || typeof (item as { id?: unknown }).id !== "string") return []
      const choice = parseRouterChoice((item as { choice?: unknown }).choice)
      return [{ id: (item as { id: string }).id, choice, ...draft.draft }]
    })
  } catch {
    return []
  }
}

function writeRouters(routers: RouterRecord[]) {
  fs.mkdirSync(path.dirname(routersPath()), { recursive: true })
  fs.writeFileSync(routersPath(), JSON.stringify(routers, null, 2))
}

function findRouter(id: unknown): RouterRecord | null {
  if (typeof id !== "string") return null
  return readRouters().find((item) => item.id === id) ?? null
}

async function confirmRouter(parent: BrowserWindow | null, name: string, action: "restart" | "reset"): Promise<boolean> {
  const reset = action === "reset"
  const options = {
    type: "warning" as const,
    buttons: [reset ? "Reset" : "Restart", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    message: reset ? `Erase settings on “${name}”?` : `Restart “${name}”?`,
    detail: reset
      ? "The router returns to its first setup and then restarts. This cannot be undone."
      : "The network drops until the router comes back.",
  }
  const result = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options)
  return result.response === 0
}

async function confirmDelete(parent: BrowserWindow | null, name: string, args: string[]): Promise<boolean> {
  const paths = name === "rm" && args[0] === "-r" ? args.slice(1) : args
  const names = paths.map((item) => item.split(/[/\\]/).filter(Boolean).pop() ?? item)
  const preview = names.slice(0, 8).join("\n")
  const more = names.length > 8 ? `\n…and ${names.length - 8} more` : ""
  const folder = name === "rm" && args[0] === "-r"
  const options = {
    type: "warning" as const,
    buttons: ["Delete", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    message: names.length === 1 ? `Delete “${names[0]}”?` : `Delete ${names.length} items?`,
    detail: `${preview}${more}\n\n${folder ? "A folder is included, so everything inside it is removed too.\n" : ""}${
      process.platform === "win32"
        ? "This uses Remove-Item and does not move items to the Recycle Bin."
        : `This uses ${name} and does not move items to the Trash.`
    }`,
  }
  const result = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options)
  return result.response === 0
}
