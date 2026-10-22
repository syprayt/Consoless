import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { categoryOf } from "../shared/classify"
import { KNOWN } from "../shared/known"
import { BLOCKED_NAMES, INTERACTIVE_NAMES, isBlockedName } from "../shared/policy"
import type { RouterRecord } from "../shared/router"
import { computerPhrase, detectSystem } from "../shared/device"
import { routerLabel } from "../shared/router"
import type { Catalog, CommandInfo, ComputerFact, ComputerReport, ComputerSection, RunResult } from "../shared/types"

const exec = promisify(execFile)

const NAME_OK = /^[A-Za-z0-9._+-]+$/

const INFO_SCRIPT = `
set +e
board=
if command -v ubus >/dev/null 2>&1; then
  board=$(ubus call system board 2>/dev/null)
fi
printf '%s\\n' '@@KIND@@'
if [ -n "$board" ]; then printf '%s\\n' openwrt; else printf '%s\\n' linux; fi
printf '%s\\n' '@@REBOOT@@'
if command -v reboot >/dev/null 2>&1; then printf '%s\\n' yes; else printf '%s\\n' no; fi
printf '%s\\n' '@@RESET@@'
if command -v firstboot >/dev/null 2>&1; then printf '%s\\n' yes; else printf '%s\\n' no; fi
printf '%s\\n' '@@BOARD@@'
printf '%s\\n' "$board"
printf '%s\\n' '@@OS@@'
cat /etc/os-release 2>/dev/null
printf '%s\\n' '@@UNAME@@'
uname -srm 2>/dev/null
printf '%s\\n' '@@HOST@@'
hostname 2>/dev/null || cat /proc/sys/kernel/hostname 2>/dev/null
printf '%s\\n' '@@UPTIME@@'
uptime 2>/dev/null
printf '%s\\n' '@@MEM@@'
free -h 2>/dev/null || free 2>/dev/null || cat /proc/meminfo 2>/dev/null
printf '%s\\n' '@@DF@@'
df -h 2>/dev/null
printf '%s\\n' '@@ADDR@@'
ip -br addr 2>/dev/null || ip addr 2>/dev/null || ifconfig 2>/dev/null
printf '%s\\n' '@@MODEL@@'
cat /tmp/sysinfo/model 2>/dev/null
printf '%s\\n' '@@WIFI@@'
iwinfo 2>/dev/null | head -n 60
`

const LIST_SCRIPT = `
set +e
printf '%s\\n' '@@HOST@@'
hostname 2>/dev/null || cat /proc/sys/kernel/hostname 2>/dev/null
printf '%s\\n' '@@KIND@@'
if command -v ubus >/dev/null 2>&1 && ubus call system board >/dev/null 2>&1; then printf '%s\\n' openwrt; else printf '%s\\n' linux; fi
printf '%s\\n' '@@NAMES@@'
n=0
IFS=:
PATH=\${PATH:-/bin:/usr/bin:/sbin:/usr/sbin}
for d in $PATH; do
  [ -d "$d" ] || continue
  for f in "$d"/*; do
    [ -x "$f" ] || continue
    n=$((n + 1))
    [ "$n" -le 2500 ] && printf '%s\\n' "\${f##*/}"
  done
done
`

export async function suggestGateway(): Promise<string> {
  try {
    const { stdout } = await exec("route", ["-n", "get", "default"], { timeout: 4000, encoding: "utf8" })
    return stdout.match(/gateway:\s*(\d+\.\d+\.\d+\.\d+)/)?.[1] ?? ""
  } catch {
    return ""
  }
}

export async function readRouter(router: RouterRecord): Promise<ComputerReport> {
  const probe = await ssh(router, INFO_SCRIPT, 20000)
  if (!probe.ok) return failedReport(router, probe.error)
  const report = describeRouter(probe.output, router)
  return { ...report, commands: [{ command: `ssh ${router.user}@${router.host}`, output: clip(probe.output) }] }
}

export async function routerCatalog(router: RouterRecord): Promise<Catalog> {
  const probe = await ssh(router, LIST_SCRIPT, 20000)
  if (!probe.ok) throw new Error(probe.error)
  const parts = splitMarked(probe.output)
  const kind = parts.get("KIND") === "openwrt" ? "openwrt" : "linux"
  const names = [...new Set((parts.get("NAMES") ?? "").split("\n").map((name) => name.trim()).filter((name) => NAME_OK.test(name)))]
  names.sort((a, b) => a.localeCompare(b, "en"))
  return {
    hostname: parts.get("HOST") || router.host,
    home: "/",
    system: "linux",
    firmware: kind,
    commands: names.map(commandInfo),
  }
}

const DEVICES_SCRIPT = `
set +e
printf '%s\\n' '@@LEASES@@'
cat /tmp/dhcp.leases 2>/dev/null
printf '%s\\n' '@@NEIGH@@'
ip neigh 2>/dev/null || ip neighbor 2>/dev/null || cat /proc/net/arp 2>/dev/null
`

export async function routerDevices(router: RouterRecord): Promise<{ facts: ComputerFact[] } | { error: string }> {
  const probe = await ssh(router, DEVICES_SCRIPT, 20000)
  if (!probe.ok) return { error: probe.error }
  return { facts: describeConnected(probe.output) }
}

export function describeConnected(text: string): ComputerFact[] {
  const parts = splitMarked(text)
  const seen = new Set<string>()
  const facts: ComputerFact[] = []
  const add = (ip: string, mac: string, name = "") => {
    const address = ip.trim()
    const hardware = mac.trim().toLowerCase()
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(address) || address.startsWith("127.")) return
    if (!/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/.test(hardware) || hardware === "00:00:00:00:00:00") return
    if (seen.has(address)) return
    seen.add(address)
    const label = name.replace(/[\r\n\0]/g, "").trim()
    facts.push({ label: label && label !== "*" ? label.slice(0, 40) : address, value: label && label !== "*" ? `${address} · ${hardware}` : hardware })
  }
  for (const line of (parts.get("LEASES") ?? "").split("\n")) {
    const match = line.match(/^\d+\s+([0-9a-f:]{17})\s+(\d+\.\d+\.\d+\.\d+)\s+(\S+)/i)
    if (match) add(match[2] ?? "", match[1] ?? "", match[3] ?? "")
  }
  for (const line of (parts.get("NEIGH") ?? text).split("\n")) {
    if (/\b(FAILED|INCOMPLETE)\b/i.test(line)) continue
    const neigh = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+.*\blladdr\s+([0-9a-f:]{17})/i)
    if (neigh) {
      add(neigh[1] ?? "", neigh[2] ?? "")
      continue
    }
    const arp = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+\S+\s+(0x[0-9a-f]+)\s+([0-9a-f:]{17})/i)
    if (arp && arp[2]?.toLowerCase() !== "0x0") add(arp[1] ?? "", arp[3] ?? "")
  }
  return facts.slice(0, 40)
}

export async function routerPower(router: RouterRecord, action: "restart" | "reset"): Promise<RunResult> {
  const script = action === "reset" ? "command -v firstboot >/dev/null 2>&1 && firstboot -y && reboot" : "command -v reboot >/dev/null 2>&1 && reboot"
  const probe = await ssh(router, script, 15000)
  const closed = /closed by remote host|connection reset|broken pipe/i.test(probe.ok ? probe.output : probe.error)
  if (probe.ok || closed) {
    return { ok: true, code: 0, stdout: action === "reset" ? "Settings erased. The router is restarting." : "The router is restarting.", stderr: "", timedOut: false, argv: [action] }
  }
  return { ok: false, code: 1, stdout: "", stderr: "", timedOut: false, argv: [action], error: "The router did not respond." }
}

export function describeRouter(text: string, router: RouterRecord): ComputerReport {
  const parts = splitMarked(text)
  const kind = parts.get("KIND") === "openwrt" ? "openwrt" : "linux"
  const shown = router.choice === "auto" ? kind : router.choice
  const board = parseBoard(parts.get("BOARD") ?? "")
  const release = parseRelease(parts.get("OS") ?? "")
  const memory = parseMemory(parts.get("MEM") ?? "")
  const model = board.model || clean(parts.get("MODEL") ?? "")
  const edition = board.description || release.get("PRETTY_NAME") || release.get("NAME") || ""
  const resetAllowed = shown === "openwrt" && parts.get("RESET") === "yes"
  const sections = [
    section("This router", [
      fact("Name", board.hostname || clean(parts.get("HOST") ?? "") || router.name),
      fact("Address", router.host),
      fact("Model", model),
      fact("System", board.system),
      fact("Memory", memory.total),
    ]),
    section(routerLabel(shown), [
      fact("Firmware", edition),
      fact("Version", board.version || release.get("VERSION") || release.get("VERSION_ID") || ""),
      fact("Revision", board.revision),
      fact("Kernel", board.kernel || clean(parts.get("UNAME") ?? "")),
      fact("Running", parseUptime(parts.get("UPTIME") ?? "")),
    ]),
    section("Memory", [fact("Total", memory.total), fact("Available", memory.available)]),
    section("Storage", diskFacts(parts.get("DF") ?? "")),
    section("Network", networkFacts(parts.get("ADDR") ?? "")),
    section("Wireless", wirelessFacts(parts.get("WIFI") ?? "")),
  ].filter((item) => item.facts.length > 0)
  return {
    detected: "linux",
    choice: "auto",
    system: "linux",
    sections,
    commands: [],
    router: { id: router.id, canRestart: parts.get("REBOOT") === "yes", canReset: resetAllowed },
  }
}

function section(title: string, facts: Array<ComputerFact | null>): ComputerSection {
  return { title, facts: facts.filter((item): item is ComputerFact => item !== null) }
}

function fact(label: string, value: string, warn = false): ComputerFact | null {
  const trimmed = value.trim().replace(/[ \t]{2,}/g, " ")
  if (!trimmed) return null
  return warn ? { label, value: trimmed, warn: true } : { label, value: trimmed }
}

function failedReport(router: RouterRecord, error: string): ComputerReport {
  return {
    detected: "linux",
    choice: "auto",
    system: "linux",
    notice: error,
    sections: [
      {
        title: "This router",
        facts: [
          { label: "Name", value: router.name },
          { label: "Address", value: router.host },
        ],
      },
    ],
    commands: [],
    router: { id: router.id, canRestart: false, canReset: false },
  }
}

async function ssh(router: RouterRecord, script: string, timeout: number): Promise<{ ok: true; output: string } | { ok: false; error: string }> {
  try {
    const { stdout, stderr } = await exec("ssh", sshArgs(router, script), { timeout, maxBuffer: 2_000_000, encoding: "utf8" })
    return { ok: true, output: stdout.trim() || stderr.trim() }
  } catch (error) {
    const stderr = textField(error, "stderr")
    const stdout = textField(error, "stdout")
    const message = error instanceof Error ? error.message : ""
    return { ok: false, error: explain(`${stderr}\n${stdout}\n${message}`) }
  }
}

function sshArgs(router: RouterRecord, script: string): string[] {
  return [
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=8",
    "-o", "StrictHostKeyChecking=accept-new",
    "-p", String(router.port),
    `${router.user}@${router.host}`,
    script,
  ]
}

function explain(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes("permission denied") || lower.includes("publickey") || lower.includes("authentication")) {
    return `The router did not accept the key. Add the SSH key from ${computerPhrase(detectSystem(process.platform))} on the router, then try again.`
  }
  if (lower.includes("timed out") || lower.includes("connection refused") || lower.includes("no route") || lower.includes("could not resolve")) {
    return "The router did not answer."
  }
  return "The router could not be reached."
}

function textField(error: unknown, key: "stdout" | "stderr"): string {
  if (typeof error !== "object" || error === null || !(key in error)) return ""
  const value = (error as { stdout?: unknown; stderr?: unknown })[key]
  return typeof value === "string" ? value.trim() : ""
}

function splitMarked(text: string): Map<string, string> {
  const map = new Map<string, string>()
  const parts = text.split(/@@([A-Z]+)@@\n?/)
  for (let index = 1; index < parts.length; index += 2) map.set(parts[index] ?? "", (parts[index + 1] ?? "").trim())
  return map
}

function parseBoard(text: string): { hostname: string; model: string; system: string; kernel: string; description: string; version: string; revision: string } {
  const empty = { hostname: "", model: "", system: "", kernel: "", description: "", version: "", revision: "" }
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) return empty
  try {
    const board = JSON.parse(text.slice(start, end + 1)) as { hostname?: string; model?: string; system?: string; kernel?: string; release?: { description?: string; version?: string; revision?: string } }
    return {
      hostname: clean(board.hostname ?? ""),
      model: clean(board.model ?? ""),
      system: clean(board.system ?? ""),
      kernel: clean(board.kernel ?? ""),
      description: clean(board.release?.description ?? ""),
      version: clean(board.release?.version ?? ""),
      revision: clean(board.release?.revision ?? ""),
    }
  } catch {
    return empty
  }
}

function parseRelease(text: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    map.set(match[1], value)
  }
  return map
}

function parseMemory(text: string): { total: string; available: string } {
  const mem = text.split("\n").find((line) => line.startsWith("Mem:"))?.trim().split(/\s+/)
  if (mem && mem.length >= 7) return { total: mem[1] ?? "", available: mem[6] ?? "" }
  if (mem && mem.length >= 3) return { total: mem[1] ?? "", available: mem[2] ?? "" }
  const total = text.match(/^MemTotal:\s+(\d+)/m)
  const available = text.match(/^MemAvailable:\s+(\d+)/m)
  return { total: fromKb(Number(total?.[1] ?? 0)), available: fromKb(Number(available?.[1] ?? 0)) }
}

function fromKb(kb: number): string {
  if (!kb) return ""
  const gb = kb / 1024 / 1024
  return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`
}

function parseUptime(text: string): string {
  const up = text.match(/\bup\s+(.+),\s+\d+\s+users?\b/)?.[1]?.replace(/\s+/g, " ").trim()
  return up ? `Up ${up}` : ""
}

function diskFacts(text: string): Array<ComputerFact | null> {
  const lines = text.trim().split("\n").filter(Boolean)
  const mac = /iused/i.test(lines[0] ?? "")
  return lines.slice(1).flatMap((line) => {
    const parts = line.trim().split(/\s+/)
    const mount = parts.at(-1) ?? ""
    if (mount !== "/" && mount !== "/overlay") return []
    if (mac) {
      if (parts.length < 9 || !parts[4]?.endsWith("%")) return []
      const full = Number.parseInt(parts[4], 10) >= 90
      return [fact(mount === "/" ? "Root" : "Overlay", `${parts[2]} used · ${parts[3]} free · ${parts[1]} (${parts[4]})`, full)]
    }
    if (parts.length < 6 || !parts.at(-2)?.endsWith("%")) return []
    const capacity = parts.at(-2) ?? ""
    const full = Number.parseInt(capacity, 10) >= 90
    return [fact(mount === "/" ? "Root" : "Overlay", `${parts.at(-4)} used · ${parts.at(-3)} free · ${parts.at(-5)} (${capacity})`, full)]
  })
}

function networkFacts(text: string): Array<ComputerFact | null> {
  if (/^\S+\s+\S+\s+\S+/.test(text) && text.includes("/")) {
    return text.split("\n").flatMap((line) => {
      const parts = line.trim().split(/\s+/)
      const name = parts[0] ?? ""
      if (!name || name === "lo") return []
      const address = parts.slice(2).find((part) => part.includes(".") && !part.startsWith("127."))
      if (!address) return []
      return [fact(name, address)]
    })
  }
  const facts: Array<ComputerFact | null> = []
  let name = ""
  for (const line of text.split("\n")) {
    const head = line.match(/^\d+:\s+([^:]+):/)
    if (head) {
      name = head[1]?.trim() ?? ""
      continue
    }
    const inet = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+(?:\/\d+)?)/)
    if (inet && name && name !== "lo" && !inet[1]?.startsWith("127.")) facts.push(fact(name, inet[1] ?? ""))
  }
  return facts
}

function wirelessFacts(text: string): Array<ComputerFact | null> {
  const names = [...text.matchAll(/ESSID:\s*"([^"]*)"/g)].map((match) => match[1]?.trim() ?? "").filter(Boolean)
  const channel = text.match(/Channel:\s*([^\n]+)/)?.[1]?.trim() ?? ""
  const signal = text.match(/Signal:\s*([^\n]+)/)?.[1]?.trim() ?? ""
  return [fact("Network", names.join(", ")), fact("Channel", channel), fact("Signal", signal)]
}

function commandInfo(name: string): CommandInfo {
  const known = KNOWN[name]
  return {
    name,
    title: known?.title ?? name,
    summary: known?.summary ?? "",
    category: categoryOf(name),
    known: Boolean(known),
    kind: "program",
    path: "",
    blocked: Boolean(known?.blocked) || isBlockedName(name) || BLOCKED_NAMES.has(name),
    interactive: Boolean(known?.interactive) || INTERACTIVE_NAMES.has(name),
    note: known?.note ?? null,
  }
}

function clean(value: string): string {
  return value.trim()
}

function clip(value: string): string {
  return value.length > 8000 ? `${value.slice(0, 8000)}\n…` : value
}
