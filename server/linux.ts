import { execFile } from "node:child_process"
import os from "node:os"
import { promisify } from "node:util"
import { systemLabel, type SystemChoice, type SystemId } from "../shared/device"
import type { ComputerCommand, ComputerFact, ComputerReport, ComputerSection } from "../shared/types"

const exec = promisify(execFile)

type Probe = { command: string; output: string }

export type LinuxRaw = {
  osRelease: string
  uname: string
  hostname: string
  user: string
  gecos: string
  uptime: string
  lscpu: string
  cpuinfo: string
  free: string
  meminfo: string
  df: string
  lsblk: string
  addr: string
  link: string
  locale: string
  zoneLink: string
  zoneAbbrev: string
  vendor: string
  product: string
  version: string
}

export async function readLinux(detected: SystemId, choice: SystemChoice): Promise<ComputerReport> {
  const username = os.userInfo().username
  const probes = await Promise.all([
    run("cat", ["/etc/os-release"]),
    run("uname", ["-srm"]),
    run("hostname", []),
    run("whoami", []),
    run("getent", ["passwd", username]),
    run("uptime", []),
    run("lscpu", []),
    run("cat", ["/proc/cpuinfo"]),
    run("free", ["-h"]),
    run("cat", ["/proc/meminfo"]),
    run("df", ["-h"]),
    run("lsblk", ["-d", "-P", "-o", "NAME,SIZE,TYPE,TRAN,MODEL"]),
    run("ip", ["-br", "addr"]),
    run("ip", ["-br", "link"]),
    run("locale", []),
    run("readlink", ["/etc/localtime"]),
    run("date", ["+%Z"]),
    run("cat", ["/sys/class/dmi/id/sys_vendor"]),
    run("cat", ["/sys/class/dmi/id/product_name"]),
    run("cat", ["/sys/class/dmi/id/product_version"]),
  ])
  const [osRelease, uname, hostname, user, gecos, uptime, lscpu, cpuinfo, free, meminfo, df, lsblk, addr, link, locale, zoneLink, zoneAbbrev, vendor, product, version] = probes
  const raw: LinuxRaw = {
    osRelease: usable(osRelease.output),
    uname: usable(uname.output),
    hostname: usable(hostname.output),
    user: usable(user.output),
    gecos: usable(gecos.output),
    uptime: usable(uptime.output),
    lscpu: usable(lscpu.output),
    cpuinfo: usable(cpuinfo.output),
    free: usable(free.output),
    meminfo: usable(meminfo.output),
    df: usable(df.output),
    lsblk: usable(lsblk.output),
    addr: usable(addr.output),
    link: usable(link.output),
    locale: usable(locale.output),
    zoneLink: usable(zoneLink.output),
    zoneAbbrev: usable(zoneAbbrev.output),
    vendor: usable(vendor.output),
    product: usable(product.output),
    version: usable(version.output),
  }
  const built = describeLinux(raw)
  const notice = detected === "linux" ? undefined : `This computer is ${systemLabel(detected)}. These details were read with Linux commands. File actions still follow this computer.`
  return { detected, choice, system: "linux", notice, sections: built.sections, commands: probes.map(shown) }
}

export function describeLinux(raw: LinuxRaw): { sections: ComputerSection[] } {
  const release = parseRelease(raw.osRelease)
  const cpu = parseLscpu(raw.lscpu)
  const cpuinfo = parseCpuinfo(raw.cpuinfo)
  const memory = parseFree(raw.free) ?? parseMeminfo(raw.meminfo)
  const machine = raw.uname.split(/\s+/).at(-1) ?? ""
  const { up, load } = parseUptime(raw.uptime)
  const sections = [
    section("This device", [
      fact("Computer", raw.product),
      fact("Vendor", raw.vendor),
      fact("Version", raw.version),
      fact("CPU", cpu.model || cpuinfo.model),
      fact("Architecture", cpu.architecture || machine),
      fact("Cores", cpu.cores || cpuinfo.cores),
      fact("Memory", memory?.total ?? ""),
    ]),
    section("Linux", [
      fact("Distribution", release.get("PRETTY_NAME") || release.get("NAME") || ""),
      fact("Version", release.get("VERSION") || release.get("VERSION_ID") || ""),
      fact("Kernel", raw.uname),
      fact("Hostname", raw.hostname),
      fact("User", person(raw.gecos, raw.user)),
      fact("Language", localeValue(raw.locale, "LANG")),
      fact("Time zone", zoneName(raw.zoneLink) || raw.zoneAbbrev),
      fact("Running", up ?? ""),
      fact("Load", load ?? ""),
    ]),
    section("Memory", [
      fact("Total", memory?.total ?? ""),
      fact("Available", memory?.available ?? ""),
      fact("Swap", memory?.swap ?? ""),
    ]),
    section("Storage", [...diskFacts(raw.df), ...driveFacts(raw.lsblk)]),
    section("Network", networkFacts(raw.addr, raw.link)),
  ].filter((item) => item.facts.length > 0)
  return { sections }
}

function section(title: string, facts: Array<ComputerFact | null>): ComputerSection {
  return { title, facts: facts.filter((item): item is ComputerFact => item !== null) }
}

function fact(label: string, value: string, warn = false): ComputerFact | null {
  const trimmed = value.trim().replace(/[ \t]{2,}/g, " ")
  if (!trimmed) return null
  return warn ? { label, value: trimmed, warn: true } : { label, value: trimmed }
}

async function run(file: string, args: string[]): Promise<Probe> {
  const command = [file, ...args].join(" ")
  try {
    const { stdout, stderr } = await exec(file, args, { timeout: 5000, maxBuffer: 1_000_000, encoding: "utf8" })
    return { command, output: stdout.trim() || stderr.trim() || "(no output)" }
  } catch (error) {
    const stdout = textField(error, "stdout")
    const stderr = textField(error, "stderr")
    const message = error instanceof Error ? error.message : "Could not read this."
    return { command, output: stdout || stderr || message }
  }
}

function textField(error: unknown, key: "stdout" | "stderr"): string {
  if (typeof error !== "object" || error === null || !(key in error)) return ""
  const value = (error as { stdout?: unknown; stderr?: unknown })[key]
  return typeof value === "string" ? value.trim() : ""
}

function usable(output: string): string {
  if (!output.trim() || output === "(no output)") return ""
  if (/ENOENT|command not found|No such file|Permission denied|not found|usage:/i.test(output)) return ""
  if (output.startsWith("Command failed")) return ""
  return output.trim()
}

function shown(probe: Probe): ComputerCommand {
  const output = usable(probe.output) ? probe.output : "Not available on this computer."
  return { command: probe.command, output: output.length > 8000 ? `${output.slice(0, 8000)}\n…` : output }
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

function parseLscpu(text: string): { model: string; architecture: string; cores: string } {
  const map = colonMap(text)
  return {
    model: map.get("Model name") ?? "",
    architecture: map.get("Architecture") ?? "",
    cores: map.get("CPU(s)") ?? "",
  }
}

function parseCpuinfo(text: string): { model: string; cores: string } {
  const models = text.split("\n").map((line) => line.match(/^model name\s*:\s*(.+)$/i)?.[1]?.trim() ?? "").filter(Boolean)
  const processors = text.split("\n").filter((line) => /^processor\s*:/i.test(line)).length
  return { model: models[0] ?? "", cores: processors > 0 ? String(processors) : "" }
}

function parseFree(text: string): { total: string; available: string; swap: string } | null {
  const mem = text.split("\n").find((line) => line.startsWith("Mem:"))?.trim().split(/\s+/)
  if (!mem || mem.length < 7) return null
  const swap = text.split("\n").find((line) => line.startsWith("Swap:"))?.trim().split(/\s+/)
  return { total: mem[1] ?? "", available: mem[6] ?? "", swap: swap && swap[1] && swap[1] !== "0B" ? swap[1] : "" }
}

function parseMeminfo(text: string): { total: string; available: string; swap: string } | null {
  const total = meminfoKb(text, "MemTotal")
  const available = meminfoKb(text, "MemAvailable")
  const swap = meminfoKb(text, "SwapTotal")
  if (!total && !available) return null
  return { total: fromKb(total), available: fromKb(available), swap: fromKb(swap) }
}

function meminfoKb(text: string, key: string): number {
  const match = text.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"))
  return match ? Number(match[1]) : 0
}

function fromKb(kb: number): string {
  if (!kb) return ""
  const gb = kb / 1024 / 1024
  return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`
}

function colonMap(text: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of text.split("\n")) {
    const index = line.indexOf(":")
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim()
    if (key && value) map.set(key, value)
  }
  return map
}

function parseUptime(text: string): { up: string | null; load: string | null } {
  const up = text.match(/\bup\s+(.+),\s+\d+\s+users?\b/)?.[1]?.replace(/\s+/g, " ").trim() ?? null
  const load = text.match(/load averages?:\s*(.+)$/)?.[1]?.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean).join(", ") ?? null
  return { up: up ? `Up ${up}` : null, load }
}

function person(gecos: string, login: string): string {
  const fields = gecos.split(":")
  const name = (fields.length > 4 ? fields[4] : "").split(",")[0]?.trim() ?? ""
  if (!name || name === login) return login
  return login ? `${name} (${login})` : name
}

function localeValue(text: string, key: string): string {
  const line = text.split("\n").find((item) => item.startsWith(`${key}=`))
  if (!line) return ""
  let value = line.slice(key.length + 1).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
  return value
}

function zoneName(link: string): string {
  const marker = "zoneinfo/"
  const index = link.lastIndexOf(marker)
  if (index < 0) return ""
  return link.slice(index + marker.length).trim()
}

function diskFacts(text: string): Array<ComputerFact | null> {
  const lines = text.trim().split("\n").filter(Boolean)
  const mac = /iused/i.test(lines[0] ?? "")
  const rows = lines.slice(1).flatMap((line) => {
    const parts = line.trim().split(/\s+/)
    if (mac) {
      if (parts.length < 9 || !parts[4]?.endsWith("%")) return []
      return [{ mount: parts.at(-1) ?? "", size: parts[1] ?? "", used: parts[2] ?? "", avail: parts[3] ?? "", capacity: parts[4] ?? "", filesystem: parts[0] ?? "" }]
    }
    if (parts.length < 6 || !parts.at(-2)?.endsWith("%")) return []
    return [{
      mount: parts.at(-1) ?? "",
      capacity: parts.at(-2) ?? "",
      avail: parts.at(-3) ?? "",
      used: parts.at(-4) ?? "",
      size: parts.at(-5) ?? "",
      filesystem: parts.slice(0, -5).join(" "),
    }]
  })
  const wanted = [
    { mount: "/", label: "Root" },
    { mount: "/home", label: "Home" },
  ]
  return wanted.map(({ mount, label }) => {
    const row = rows.find((item) => item.mount === mount && !/tmpfs|devtmpfs|overlay/i.test(item.filesystem))
    if (!row) return null
    const full = Number.parseInt(row.capacity, 10) >= 90
    return fact(label, `${row.used} used · ${row.avail} free · ${row.size} (${row.capacity})`, full)
  })
}

function driveFacts(text: string): Array<ComputerFact | null> {
  return text.split("\n").flatMap((line) => {
    const fields = new Map([...line.matchAll(/([A-Z]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]))
    if (fields.get("TYPE") !== "disk") return []
    const name = fields.get("NAME") ?? ""
    const value = [fields.get("SIZE") ?? "", fields.get("TRAN") ?? "", fields.get("MODEL") ?? ""].filter(Boolean).join(" · ")
    const item = fact(name, value)
    return item ? [item] : []
  })
}

function networkFacts(addrText: string, linkText: string): Array<ComputerFact | null> {
  const links = new Map<string, string>()
  for (const line of linkText.split("\n")) {
    const parts = line.trim().split(/\s+/)
    const mac = parts.find((part) => /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i.test(part)) ?? ""
    if (parts[0] && mac) links.set(parts[0], mac.toLowerCase())
  }
  const facts: Array<ComputerFact | null> = []
  for (const line of addrText.split("\n")) {
    const parts = line.trim().split(/\s+/)
    const name = parts[0] ?? ""
    if (!name || name === "lo") continue
    const addresses = parts.slice(2).filter((part) => part.includes(".") && !part.startsWith("127."))
    const mac = links.get(name) ?? ""
    if (addresses.length === 0 && !mac) continue
    facts.push(fact(name, [addresses[0] ?? "", mac].filter(Boolean).join(" · ")))
  }
  return facts
}
