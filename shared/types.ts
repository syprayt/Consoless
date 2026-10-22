import type { SystemChoice, SystemId } from "./device"
import type { CategoryId } from "./taxonomy"

export type CommandInfo = {
  name: string
  title: string
  summary: string
  category: CategoryId
  known: boolean
  kind: "program" | "builtin"
  path: string
  blocked: boolean
  interactive: boolean
  note: string | null
}

export type Catalog = {
  hostname: string
  home: string
  system: SystemId
  firmware?: "openwrt" | "linux"
  commands: CommandInfo[]
}

export type RouterControls = {
  id: string
  canRestart: boolean
  canReset: boolean
}

export type CommandDetail = {
  name: string
  manual: string | null
}

export type RunResult = {
  ok: boolean
  code: number
  stdout: string
  stderr: string
  timedOut: boolean
  argv: string[]
  error?: string
}

export type ComputerFact = {
  label: string
  value: string
  warn?: boolean
}

export type ComputerSection = {
  title: string
  facts: ComputerFact[]
}

export type ComputerCommand = {
  command: string
  output: string
}

export type ComputerReport = {
  detected: SystemId
  choice: SystemChoice
  system: SystemId
  notice?: string
  sections: ComputerSection[]
  commands: ComputerCommand[]
  router?: RouterControls
}
