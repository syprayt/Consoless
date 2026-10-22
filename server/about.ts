import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { detectSystem, resolveSystem, systemLabel, unavailableNotice, type SystemChoice, type SystemId } from "../shared/device"
import { readLinux } from "./linux"
import { readWindows } from "./windows"
import type { ComputerCommand, ComputerFact, ComputerReport, ComputerSection } from "../shared/types"

const exec = promisify(execFile)

type Probe = {
  command: string
  output: string
}

type Node = {
  name: string
  values: Map<string, string>
  children: Node[]
}

type Port = {
  name: string
  device: string
  mac: string
}

export async function readComputer(choice: SystemChoice = "auto"): Promise<ComputerReport> {
  const detected = detectSystem(process.platform)
  const system = resolveSystem(choice, detected)
  if (system === "linux") return readLinux(detected, choice)
  if (system === "windows") return readWindows(detected, choice)
  if (system !== "macos") return unavailableReport(detected, choice, system)
  const report = await readMac()
  return { detected, choice, system, sections: report.sections, commands: report.commands }
}

async function readMac(): Promise<Pick<ComputerReport, "sections" | "commands">> {
  const probes = await Promise.all([
    run("sw_vers", []),
    run("scutil", ["--get", "ComputerName"]),
    run("hostname", []),
    run("whoami", []),
    run("id", ["-F"]),
    run("uptime", []),
    run("sysctl", ["-n", "hw.machine", "hw.memsize"]),
    run("readlink", ["/etc/localtime"]),
    run("date", ["+%Z"]),
    run("defaults", ["read", "-g", "AppleLocale"]),
    run("defaults", ["read", "-g", "AppleLanguages"]),
    run("pmset", ["-g", "batt"]),
    run("ifconfig", []),
    run("networksetup", ["-listallhardwareports"]),
    run("system_profiler", ["SPHardwareDataType", "SPSoftwareDataType", "SPDisplaysDataType", "SPPowerDataType", "SPStorageDataType", "SPNetworkDataType"], 25000),
    run("system_profiler", ["SPAirPortDataType", "-detailLevel", "basic"], 20000),
    run("system_profiler", ["SPBluetoothDataType"], 15000),
  ])
  const [swVers, computerName, hostname, user, fullName, uptime, machine, zoneLink, zoneAbbrev, locale, languages, power, interfaces, ports, profile, airport, bluetooth] = probes
  const hardwareTree = parseTree(profile.output)
  const wifiTree = parseTree(airport.output)
  const bluetoothTree = parseTree(controllerBlock(bluetooth.output))
  const overview = findNode(hardwareTree, "Hardware Overview")
  const software = findNode(hardwareTree, "System Software Overview")
  const versions = colonMap(swVers.output)
  const sysctlLines = machine.output.split("\n").map((line) => line.trim())
  const architecture = sysctlLines[0] && !sysctlLines[0].includes(" ") ? sysctlLines[0] : ""
  const memoryBytes = sysctlLines[1] ?? ""
  const { load } = parseUptime(uptime.output)
  const graphics = findNode(hardwareTree, "Graphics/Displays")?.children[0] ?? null
  const panels = graphics?.children.find((item) => item.name === "Displays")?.children ?? []
  const dataVolume = findNode(hardwareTree, "Storage")?.children.find((item) => value(item, "Mount Point") === "/System/Volumes/Data") ?? findNode(hardwareTree, "Storage")?.children[0] ?? null
  const drive = dataVolume?.children.find((item) => item.name === "Physical Drive") ?? null
  const health = findNode(hardwareTree, "Health Information")
  const charger = findNode(hardwareTree, "AC Charger Information")
  const batteryModel = findNode(hardwareTree, "Model Information")
  const wifiService = child(findNode(hardwareTree, "Network"), "Wi-Fi")
  const wifiCard = child(findNode(wifiTree, "Interfaces"), "en0")
  const currentNetwork = child(wifiCard, "Current Network Information")?.children[0] ?? null
  const controller = findNode(bluetoothTree, "Bluetooth Controller")
  const hardwarePorts = parsePorts(ports.output)
  const wifiPort = hardwarePorts.find((item) => /wi-fi/i.test(item.name))
  const wifiMac = (wifiPort?.mac || value(child(wifiService, "Ethernet"), "MAC Address")).toLowerCase()
  const privateMac = value(wifiCard, "MAC Address").toLowerCase()

  const sections: ComputerSection[] = [
    section("This device", [
      fact("Name", first(computerName.output, value(software, "Computer Name"))),
      fact("Model", value(overview, "Model Name")),
      fact("Chip", value(overview, "Chip")),
      fact("Architecture", architecture),
      fact("Memory", value(overview, "Memory") || formatBytes(memoryBytes)),
      fact("Cores", value(overview, "Total Number of Cores")),
      fact("Model identifier", value(overview, "Model Identifier")),
      fact("Model number", value(overview, "Model Number")),
      fact("Serial number", value(overview, "Serial Number (system)")),
      fact("Hardware UUID", value(overview, "Hardware UUID")),
      fact("Firmware", value(overview, "System Firmware Version")),
      fact("OS loader", value(overview, "OS Loader Version")),
      fact("Activation Lock", value(overview, "Activation Lock Status")),
    ]),
    section("macOS", [
      fact("Version", value(software, "System Version") || joinVersion(versions)),
      fact("Kernel", value(software, "Kernel Version")),
      fact("Boot volume", value(software, "Boot Volume")),
      fact("Boot mode", value(software, "Boot Mode")),
      fact("Hostname", clean(hostname.output)),
      fact("User", value(software, "User Name") || personLabel(fullName.output, user.output)),
      fact("Language", languageList(languages.output)),
      fact("Region", region(locale.output)),
      fact("Time zone", zoneName(zoneLink.output) || clean(zoneAbbrev.output)),
      fact("Running", value(software, "Time since boot") ? `Up ${value(software, "Time since boot")}` : parseUptime(uptime.output).up ?? ""),
      fact("Load", load ?? ""),
      fact("Secure virtual memory", value(software, "Secure Virtual Memory")),
      fact("System Integrity Protection", value(software, "System Integrity Protection"), value(software, "System Integrity Protection").toLowerCase() === "disabled"),
    ]),
    section("Display", displayFacts(graphics, panels)),
    section("Storage", storageFacts(dataVolume, drive, profile.output)),
    section("Battery", [...batteryFacts(power.output), ...batteryHealth(health, batteryModel, charger)]),
    section("Network", networkFacts(wifiService, wifiCard, currentNetwork, interfaces.output, wifiMac, privateMac)),
    section("Addresses", addressFacts(hardwarePorts, value(controller, "Address"))),
    section("Bluetooth", [
      fact("State", value(controller, "State")),
      fact("Address", formatMac(value(controller, "Address"))),
      fact("Chipset", value(controller, "Chipset")),
      fact("Firmware", value(controller, "Firmware Version")),
      fact("Discoverable", value(controller, "Discoverable")),
      fact("Transport", value(controller, "Transport")),
    ]),
  ].filter((item) => item.facts.length > 0)

  const bluetoothProbe = { command: bluetooth.command, output: controllerBlock(bluetooth.output) || bluetooth.output }
  return {
    sections,
    commands: probes.map((probe) => shown(probe === bluetooth ? bluetoothProbe : probe, probe === profile ? "Power Events:" : undefined)),
  }
}

function unavailableReport(detected: SystemId, choice: SystemChoice, system: SystemId): ComputerReport {
  return {
    detected,
    choice,
    system,
    notice: unavailableNotice(detected, system),
    sections: [
      {
        title: "This device",
        facts: [
          { label: "Detected", value: systemLabel(detected) },
          { label: "Selected", value: systemLabel(system) },
        ],
      },
    ],
    commands: [],
  }
}

function section(title: string, facts: Array<ComputerFact | null>): ComputerSection {
  return { title, facts: facts.filter((item): item is ComputerFact => item !== null) }
}

function fact(label: string, valueText: string, warn = false): ComputerFact | null {
  const trimmed = valueText.trim().replace(/[ \t]{2,}/g, " ")
  if (!trimmed || trimmed === "(no output)" || trimmed.startsWith("Command failed")) return null
  return warn ? { label, value: trimmed, warn: true } : { label, value: trimmed }
}

function displayFacts(graphics: Node | null, panels: Node[]): Array<ComputerFact | null> {
  const metal = value(graphics, "Metal Support") || value(graphics, "Metal")
  const facts: Array<ComputerFact | null> = [
    fact("Graphics", value(graphics, "Chipset Model")),
    fact("GPU cores", value(graphics, "Total Number of Cores")),
    fact("Vendor", value(graphics, "Vendor")),
    fact("Bus", value(graphics, "Bus")),
    fact("Metal", metal),
  ]
  const alone = panels.length === 1
  for (const panel of panels) {
    const prefix = alone ? "" : `${panel.name} `
    facts.push(
      fact(`${prefix}Panel`, panel.name),
      fact(`${prefix}Type`, value(panel, "Display Type")),
      fact(`${prefix}Resolution`, value(panel, "Resolution")),
      fact(`${prefix}Connection`, value(panel, "Connection Type")),
      fact(`${prefix}Main display`, value(panel, "Main Display")),
      fact(`${prefix}Mirror`, value(panel, "Mirror")),
      fact(`${prefix}Auto brightness`, value(panel, "Automatically Adjust Brightness")),
    )
  }
  return facts
}

function storageFacts(volume: Node | null, drive: Node | null, profile: string): Array<ComputerFact | null> {
  if (!volume) return diskFacts(profile)
  const freeBytes = bytesIn(value(volume, "Free"))
  const capacityBytes = bytesIn(value(volume, "Capacity"))
  const low = freeBytes !== null && capacityBytes !== null && capacityBytes > 0 && freeBytes / capacityBytes < 0.1
  const smart = value(drive, "S.M.A.R.T. Status")
  return [
    fact("Drive", value(drive, "Device Name")),
    fact("Medium", value(drive, "Medium Type")),
    fact("Protocol", value(drive, "Protocol")),
    fact("Internal", value(drive, "Internal")),
    fact("SMART", smart, Boolean(smart) && smart.toLowerCase() !== "verified"),
    fact("Your files", `${shortSize(value(volume, "Free"))} free of ${shortSize(value(volume, "Capacity"))}`, low),
    fact("File system", value(volume, "File System")),
    fact("Volume", value(volume, "BSD Name")),
  ]
}

function batteryHealth(health: Node | null, model: Node | null, charger: Node | null): Array<ComputerFact | null> {
  const capacity = value(health, "Maximum Capacity")
  const capacityNumber = Number.parseInt(capacity, 10)
  const condition = value(health, "Condition")
  const connected = value(charger, "Connected")
  const wattage = value(charger, "Wattage (W)")
  const chargerText = connected.toLowerCase() === "yes" ? ["Connected", wattage ? `${wattage} W` : ""].filter(Boolean).join(", ") : connected.toLowerCase() === "no" ? "Not connected" : connected
  return [
    fact("Cycles", value(health, "Cycle Count")),
    fact("Condition", condition, Boolean(condition) && condition.toLowerCase() !== "normal"),
    fact("Maximum capacity", capacity, Number.isFinite(capacityNumber) && capacityNumber < 80),
    fact("Battery serial", value(model, "Serial Number")),
    fact("Charger", chargerText),
  ]
}

function networkFacts(service: Node | null, card: Node | null, current: Node | null, ifconfigText: string, hardwareMac: string, privateMac: string): Array<ComputerFact | null> {
  const ipv4 = child(service, "IPv4")
  const dns = child(service, "DNS")
  const address = value(ipv4, "Addresses") || inetAddresses(ifconfigText).get("en0")?.[0] || ""
  const rate = value(current, "Transmit Rate")
  return [
    fact("Status", value(card, "Status") || (address ? "Connected" : "")),
    fact("Network", current?.name ?? ""),
    fact("Address", address),
    fact("Subnet mask", value(ipv4, "Subnet Masks")),
    fact("Router", value(ipv4, "Router")),
    fact("DNS", value(dns, "Server Addresses")),
    fact("IPv6", globalInet6(ifconfigText, "en0")),
    fact("MAC address", formatMac(hardwareMac)),
    fact("Private MAC", privateMac && hardwareMac && privateMac !== hardwareMac ? formatMac(privateMac) : ""),
    fact("PHY mode", value(current, "PHY Mode")),
    fact("Standards", value(card, "Supported PHY Modes")),
    fact("Channel", value(current, "Channel")),
    fact("Security", value(current, "Security")),
    fact("Signal", value(current, "Signal / Noise")),
    fact("Link speed", rate ? `${rate} Mb/s` : ""),
    fact("Country code", value(card, "Country Code")),
    fact("Card", value(card, "Card Type")),
  ]
}

function addressFacts(ports: Port[], bluetoothMac: string): Array<ComputerFact | null> {
  const ordered = [
    ...ports.filter((item) => /wi-fi/i.test(item.name)),
    ...ports.filter((item) => item.mac && !/wi-fi/i.test(item.name) && !/bridge/i.test(item.name)),
  ]
  const facts = ordered.map((item) => fact(item.name, formatMac(item.mac)))
  facts.push(fact("Bluetooth", formatMac(bluetoothMac)))
  return facts
}

function diskFacts(text: string): Array<ComputerFact | null> {
  const rows = text
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 9)
  return ["/System/Volumes/Data", "/"].flatMap((mount) => {
    const parts = rows.find((row) => row.at(-1) === mount)
    if (!parts) return []
    const capacity = parts[4] ?? ""
    const full = Number.parseInt(capacity, 10) >= 90
    return [fact(mount === "/" ? "Startup volume" : "Your files", `${parts[2]} used · ${parts[3]} free · ${parts[1]} (${capacity})`, full)]
  })
}

async function run(file: string, args: string[], timeout = 5000): Promise<Probe> {
  const command = [file, ...args].join(" ")
  try {
    const { stdout, stderr } = await exec(file, args, { timeout, maxBuffer: 2_000_000, encoding: "utf8" })
    const output = stdout.trim() || stderr.trim() || "(no output)"
    return { command, output }
  } catch (error) {
    const stdout = textField(error, "stdout")
    const stderr = textField(error, "stderr")
    const message = error instanceof Error ? error.message : "Could not read this."
    return { command, output: stdout || stderr || message }
  }
}

function textField(error: unknown, key: "stdout" | "stderr"): string {
  if (typeof error !== "object" || error === null || !(key in error)) return ""
  const valueText = (error as { stdout?: unknown; stderr?: unknown })[key]
  return typeof valueText === "string" ? valueText.trim() : ""
}

function shown(probe: Probe, cutMarker?: string): ComputerCommand {
  const cut = cutMarker ? cutAt(probe.output, cutMarker) : probe.output
  const output = cut.length > 12000 ? `${cut.slice(0, 12000)}\n…` : cut
  return { command: probe.command, output }
}

function cutAt(text: string, marker: string): string {
  const index = text.indexOf(marker)
  return (index < 0 ? text : text.slice(0, index)).trim()
}

function controllerBlock(text: string): string {
  const start = text.indexOf("Bluetooth Controller:")
  if (start < 0) return ""
  const rest = text.slice(start)
  const end = rest.search(/\n\s+(?:Not )?Connected:/)
  return (end < 0 ? rest : rest.slice(0, end)).trim()
}

function parseTree(text: string): Node {
  const root: Node = { name: "", values: new Map(), children: [] }
  const stack: Array<{ indent: number; node: Node }> = [{ indent: -1, node: root }]
  for (const line of text.split("\n")) {
    if (!line.trim()) continue
    const indent = line.match(/^ */)?.[0].length ?? 0
    const trimmed = line.trim()
    const split = trimmed.match(/^([^:]+):\s*(.*)$/)
    if (!split) continue
    const name = split[1].trim()
    const itemValue = split[2].trim()
    if (indent === 0 && itemValue) continue
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1].node
    if (itemValue) parent.values.set(name, itemValue)
    else {
      const childNode: Node = { name, values: new Map(), children: [] }
      parent.children.push(childNode)
      stack.push({ indent, node: childNode })
    }
  }
  return root
}

function findNode(node: Node | null, name: string): Node | null {
  if (!node) return null
  for (const item of node.children) {
    if (item.name === name) return item
    const nested = findNode(item, name)
    if (nested) return nested
  }
  return null
}

function child(node: Node | null, name: string): Node | null {
  return node?.children.find((item) => item.name === name) ?? null
}

function value(node: Node | null, key: string): string {
  return node?.values.get(key)?.trim() ?? ""
}

function colonMap(text: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of text.split("\n")) {
    const index = line.indexOf(":")
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    const itemValue = line.slice(index + 1).trim()
    if (key && itemValue) map.set(key, itemValue)
  }
  return map
}

function joinVersion(versions: Map<string, string>): string {
  const name = versions.get("ProductName") ?? ""
  const version = versions.get("ProductVersion") ?? ""
  const build = versions.get("BuildVersion") ?? ""
  const main = `${name} ${version}`.trim()
  return build && main ? `${main} (${build})` : main || build
}

function formatBytes(raw: string): string {
  const bytes = Number(raw.trim())
  if (!Number.isFinite(bytes) || bytes <= 0) return ""
  const gigabytes = bytes / 1024 ** 3
  return `${gigabytes >= 10 ? Math.round(gigabytes) : gigabytes.toFixed(1)} GB`
}

function parseUptime(text: string): { up: string | null; load: string | null } {
  const up = text.match(/\bup\s+(.+),\s+\d+\s+users?\b/)?.[1]?.replace(/\s+/g, " ").trim() ?? null
  const load = text.match(/load averages?:\s*(.+)$/)?.[1]?.trim().split(/\s+/).join(", ") ?? null
  return { up: up ? `Up ${up}` : null, load }
}

function personLabel(full: string, short: string): string {
  const name = clean(full)
  const login = clean(short)
  if (!name) return login
  if (!login || name === login) return name
  return `${name} (${login})`
}

function clean(text: string): string {
  const trimmed = text.trim()
  if (!trimmed || trimmed === "(no output)" || trimmed.startsWith("Command failed")) return ""
  return trimmed
}

function first(primary: string, fallback: string): string {
  return clean(primary) || fallback
}

function languageList(text: string): string {
  return [...text.matchAll(/"([^"]+)"/g)].map((match) => match[1]).join(", ")
}

function region(text: string): string {
  return clean(text).split("@")[0] ?? ""
}

function zoneName(link: string): string {
  const marker = "zoneinfo/"
  const index = link.lastIndexOf(marker)
  if (index < 0) return ""
  return link.slice(index + marker.length).trim()
}

function shortSize(text: string): string {
  return text.split("(")[0]?.trim() ?? ""
}

function bytesIn(text: string): number | null {
  const match = text.match(/\(([\d\s\u00a0\u202f]+) bytes\)/)
  if (!match) return null
  const bytes = Number(match[1].replace(/[^\d]/g, ""))
  return Number.isFinite(bytes) ? bytes : null
}

function formatMac(mac: string): string {
  return mac.trim().toLowerCase()
}

function parsePorts(text: string): Port[] {
  const ports: Port[] = []
  let current: Port | null = null
  for (const line of text.split("\n")) {
    const port = line.match(/^Hardware Port:\s*(.+)$/)
    const device = line.match(/^Device:\s*(\S+)$/)
    const mac = line.match(/^Ethernet Address:\s*(\S+)$/)
    if (port) {
      if (current?.name) ports.push(current)
      current = { name: port[1].trim(), device: "", mac: "" }
    } else if (device && current) current.device = device[1]
    else if (mac && current) current.mac = mac[1]
  }
  if (current?.name) ports.push(current)
  return ports
}

function inetAddresses(text: string): Map<string, string[]> {
  const map = new Map<string, string[]>()
  let name = ""
  for (const line of text.split("\n")) {
    if (/^\S/.test(line)) {
      name = line.split(":")[0]?.trim() ?? ""
      if (name && !map.has(name)) map.set(name, [])
    } else if (name) {
      const parts = line.trim().split(/\s+/)
      if (parts[0] === "inet" && parts[1] && parts[1] !== "127.0.0.1") map.get(name)?.push(parts[1])
    }
  }
  return map
}

function globalInet6(text: string, device: string): string {
  let name = ""
  const found: string[] = []
  for (const line of text.split("\n")) {
    if (/^\S/.test(line)) name = line.split(":")[0]?.trim() ?? ""
    else if (name === device) {
      const parts = line.trim().split(/\s+/)
      const address = parts[1]?.split("%")[0] ?? ""
      if (parts[0] === "inet6" && address && !address.startsWith("fe80:") && address !== "::1") found.push(address)
    }
  }
  return found[0] ?? ""
}

function batteryFacts(text: string): Array<ComputerFact | null> {
  if (!clean(text)) return []
  const source = text.match(/Now drawing from '([^']+)'/)?.[1] ?? ""
  const charge = text.match(/(\d+)%;\s*([^;]+);/)
  const remaining = text.match(/;\s*([^;]*?)\s+remaining/)
  const warning = text.match(/Battery Warning:\s*(.+)/)?.[1]?.trim() ?? ""
  const percent = charge ? Number(charge[1]) : null
  const state = charge?.[2]?.trim() ?? ""
  const left = remaining ? timeLeft(remaining[1], state) : null
  const chargeValue = [percent !== null ? `${percent}%` : "", state, left].filter(Boolean).join(", ")
  const low = percent !== null && percent <= 20
  const warningValue = warning && warning.toLowerCase() !== "none" ? warning : ""
  return [fact("Power", powerLabel(source)), fact("Charge", chargeValue, low), fact("Warning", warningValue, Boolean(warningValue))]
}

function powerLabel(source: string): string {
  if (source === "Battery Power") return "Battery"
  if (source === "AC Power") return "Power adapter"
  return source
}

function timeLeft(raw: string, state: string): string | null {
  const time = raw.match(/(\d+):(\d+)/)
  if (!time) return null
  const hours = Number(time[1])
  const minutes = Number(time[2])
  if (hours === 0 && minutes === 0) return null
  const tail = state.toLowerCase() === "charging" ? "until full" : "left"
  if (hours === 0) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ${tail}`
  return `${hours} ${hours === 1 ? "hour" : "hours"} ${minutes} ${minutes === 1 ? "minute" : "minutes"} ${tail}`
}
