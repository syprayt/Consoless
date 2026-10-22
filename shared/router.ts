export type RouterChoice = "auto" | "openwrt" | "linux"

export type RouterRecord = {
  id: string
  name: string
  host: string
  user: string
  port: number
  choice: RouterChoice
}

export type RouterDraft = {
  name: string
  host: string
  user: string
  port: number
}

const CHOICES = new Set<RouterChoice>(["auto", "openwrt", "linux"])

export function parseRouterChoice(value: unknown): RouterChoice {
  return typeof value === "string" && CHOICES.has(value as RouterChoice) ? (value as RouterChoice) : "auto"
}

export function parseRouterDraft(value: unknown): { draft: RouterDraft } | { error: string } {
  if (typeof value !== "object" || value === null) return { error: "Enter the router's address." }
  const body = value as { name?: unknown; host?: unknown; user?: unknown; port?: unknown }
  const host = typeof body.host === "string" ? body.host.trim() : ""
  const user = typeof body.user === "string" && body.user.trim() ? body.user.trim() : "root"
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : host
  const port = body.port === undefined || body.port === "" ? 22 : Number(body.port)
  if (!validHost(host)) return { error: "Enter an address like 192.168.0.1." }
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(user)) return { error: "Enter the router's user name." }
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { error: "Enter a port from 1 to 65535." }
  if (name.length > 40 || /[\r\n]/.test(name)) return { error: "Use a shorter name." }
  return { draft: { name, host, user, port } }
}

export function validHost(host: string): boolean {
  if (!host || host.startsWith("-")) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host.split(".").every((part) => Number(part) <= 255)
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(host)
}

export function routerLabel(kind: "openwrt" | "linux"): string {
  return kind === "openwrt" ? "OpenWrt" : "Linux"
}
