export type SystemId = "macos" | "linux" | "windows" | "other"

export type SystemChoice = "auto" | "macos" | "linux" | "windows"

const CHOICES = new Set<SystemChoice>(["auto", "macos", "linux", "windows"])

export function detectSystem(platform: string): SystemId {
  if (platform === "darwin") return "macos"
  if (platform === "linux") return "linux"
  if (platform === "win32") return "windows"
  return "other"
}

export function parseChoice(value: unknown): SystemChoice {
  return typeof value === "string" && CHOICES.has(value as SystemChoice) ? (value as SystemChoice) : "auto"
}

export function resolveSystem(choice: SystemChoice, detected: SystemId): SystemId {
  return choice === "auto" ? detected : choice
}

export function systemLabel(system: SystemId): string {
  if (system === "macos") return "macOS"
  if (system === "linux") return "Linux"
  if (system === "windows") return "Windows"
  return "This system"
}

export function commandsTitle(system: SystemId): string {
  if (system === "macos") return "Commands on this Mac, as ordinary icons"
  return "Commands on this computer, as ordinary icons"
}

export function lookupLabel(system: SystemId): string {
  if (system === "macos") return "Looking up programs on this Mac…"
  return "Looking up programs on this computer…"
}

export function computerPhrase(system: SystemId): string {
  return system === "macos" ? "this Mac" : "this computer"
}

export function hostShell(platform: string): "zsh" | "bash" | null {
  if (platform === "darwin") return "zsh"
  if (platform === "linux") return "bash"
  return null
}

export function unavailableNotice(detected: SystemId, selected: SystemId): string {
  const selectedLabel = systemLabel(selected)
  const tail = "File actions still follow this computer."
  if (detected === selected) return `${selectedLabel} details are not available yet. ${tail}`
  return `This computer is ${systemLabel(detected)}. ${selectedLabel} details are not available yet. ${tail}`
}
