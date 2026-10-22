import { contextBridge, ipcRenderer } from "electron"
import type { SystemChoice } from "../shared/device"
import type { RouterChoice, RouterDraft } from "../shared/router"

contextBridge.exposeInMainWorld("consoless", {
  platform: process.platform,
  catalog: (refresh: boolean) => ipcRenderer.invoke("catalog", refresh),
  detail: (name: string) => ipcRenderer.invoke("detail", name),
  computer: (choice: SystemChoice) => ipcRenderer.invoke("computer", choice),
  run: (name: string, args: string[]) => ipcRenderer.invoke("run", { name, args }),
  pick: (request: { kind: "file" | "folder" | "either"; multiple?: boolean; directory?: string }) => ipcRenderer.invoke("pick", request),
  routers: () => ipcRenderer.invoke("routers"),
  gateway: () => ipcRenderer.invoke("gateway"),
  routerSave: (draft: RouterDraft) => ipcRenderer.invoke("router-save", draft),
  routerForget: (id: string) => ipcRenderer.invoke("router-forget", id),
  routerChoice: (id: string, choice: RouterChoice) => ipcRenderer.invoke("router-choice", { id, choice }),
  routerCatalog: (id: string) => ipcRenderer.invoke("router-catalog", id),
  routerComputer: (id: string) => ipcRenderer.invoke("router-computer", id),
  routerDevices: (id: string) => ipcRenderer.invoke("router-devices", id),
  routerPower: (id: string, action: "restart" | "reset") => ipcRenderer.invoke("router-power", { id, action }),
})
