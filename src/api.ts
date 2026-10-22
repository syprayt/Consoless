import type { SystemChoice } from "../shared/device"
import type { RouterChoice, RouterDraft, RouterRecord } from "../shared/router"
import type { Picked } from "./actions"
import type { Catalog, CommandDetail, ComputerFact, ComputerReport, RunResult } from "../shared/types"

export async function loadCatalog(refresh: boolean): Promise<Catalog> {
  const api = desktop()
  return api.catalog(refresh)
}

export async function loadDetail(name: string): Promise<CommandDetail> {
  return desktop().detail(name)
}

export async function loadComputer(choice: SystemChoice): Promise<ComputerReport> {
  return desktop().computer(choice)
}

export async function runCommand(name: string, args: string[]): Promise<RunResult> {
  return desktop().run(name, args)
}

export async function pickItems(kind: "file" | "folder" | "either", multiple = false, directory?: string): Promise<Picked[]> {
  return desktop().pick({ kind, multiple, directory })
}

export async function loadRouters(): Promise<RouterRecord[]> {
  return desktop().routers()
}

export async function loadGateway(): Promise<string> {
  return desktop().gateway()
}

export async function saveRouter(draft: RouterDraft): Promise<{ router: RouterRecord } | { error: string }> {
  return desktop().routerSave(draft)
}

export async function forgetRouter(id: string): Promise<void> {
  return desktop().routerForget(id)
}

export async function chooseRouter(id: string, choice: RouterChoice): Promise<void> {
  return desktop().routerChoice(id, choice)
}

export async function loadRouterCatalog(id: string): Promise<Catalog> {
  return desktop().routerCatalog(id)
}

export async function loadRouterComputer(id: string): Promise<ComputerReport> {
  return desktop().routerComputer(id)
}

export async function loadRouterDevices(id: string): Promise<{ facts: ComputerFact[] } | { error: string }> {
  return desktop().routerDevices(id)
}

export async function powerRouter(id: string, action: "restart" | "reset"): Promise<RunResult> {
  return desktop().routerPower(id, action)
}

function desktop() {
  const api = window.consoless
  if (!api) throw new Error("Consoless opens as a Mac app. Start it with npm start.")
  return api
}
