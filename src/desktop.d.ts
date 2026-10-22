import type { SystemChoice } from "../shared/device"
import type { RouterChoice, RouterDraft, RouterRecord } from "../shared/router"
import type { Picked } from "./actions"
import type { Catalog, CommandDetail, ComputerFact, ComputerReport, RunResult } from "../shared/types"

export type PickRequest = {
  kind: "file" | "folder" | "either"
  multiple?: boolean
  directory?: string
}

export type DesktopApi = {
  platform: string
  catalog: (refresh: boolean) => Promise<Catalog>
  detail: (name: string) => Promise<CommandDetail>
  computer: (choice: SystemChoice) => Promise<ComputerReport>
  run: (name: string, args: string[]) => Promise<RunResult>
  pick: (request: PickRequest) => Promise<Picked[]>
  routers: () => Promise<RouterRecord[]>
  gateway: () => Promise<string>
  routerSave: (draft: RouterDraft) => Promise<{ router: RouterRecord } | { error: string }>
  routerForget: (id: string) => Promise<void>
  routerChoice: (id: string, choice: RouterChoice) => Promise<void>
  routerCatalog: (id: string) => Promise<Catalog>
  routerComputer: (id: string) => Promise<ComputerReport>
  routerDevices: (id: string) => Promise<{ facts: ComputerFact[] } | { error: string }>
  routerPower: (id: string, action: "restart" | "reset") => Promise<RunResult>
}

declare global {
  interface Window {
    consoless?: DesktopApi
  }
}

export {}
