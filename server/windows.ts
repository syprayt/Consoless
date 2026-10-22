import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { systemLabel, type SystemChoice, type SystemId } from "../shared/device"
import type { ComputerCommand, ComputerFact, ComputerReport, ComputerSection } from "../shared/types"

const exec = promisify(execFile)

const SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
function Emit($k, $v) { if ($null -ne $v -and "$v" -ne '') { Write-Output ("{0}={1}" -f $k, $v) } }
$cs = Get-CimInstance Win32_ComputerSystem
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$bios = Get-CimInstance Win32_BIOS
Emit 'Computer' $cs.Name
Emit 'Vendor' $cs.Manufacturer
Emit 'Model' $cs.Model
Emit 'User' $cs.UserName
if ($cs.TotalPhysicalMemory) { Emit 'Memory' (([math]::Round($cs.TotalPhysicalMemory / 1GB, 1)).ToString() + ' GB') }
if ($os.FreePhysicalMemory) { Emit 'Available' (([math]::Round($os.FreePhysicalMemory / 1MB, 1)).ToString() + ' GB') }
Emit 'Architecture' $env:PROCESSOR_ARCHITECTURE
Emit 'Cores' $cpu.NumberOfLogicalProcessors
Emit 'CPU' $cpu.Name
Emit 'Windows' $os.Caption
Emit 'Version' $os.Version
Emit 'Build' $os.BuildNumber
Emit 'Serial' $bios.SerialNumber
Emit 'Language' (Get-Culture).Name
Emit 'TimeZone' (Get-TimeZone).Id
if ($os.LastBootUpTime) {
  $span = (Get-Date) - $os.LastBootUpTime
  Emit 'Uptime' ('Up {0} days, {1} hours' -f [int]$span.TotalDays, $span.Hours)
}
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  if ($_.Size) {
    $used = [math]::Round(($_.Size - $_.FreeSpace) / 1GB, 1)
    $free = [math]::Round($_.FreeSpace / 1GB, 1)
    $size = [math]::Round($_.Size / 1GB, 1)
    $pct = [int](100 * ($_.Size - $_.FreeSpace) / $_.Size)
    Emit ("Volume " + $_.DeviceID) ("{0} GB used, {1} GB free, {2} GB, {3}%" -f $used, $free, $size, $pct)
  }
}
Get-NetAdapter | Where-Object { $_.MacAddress } | ForEach-Object {
  $ip = Get-NetIPAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' } | Select-Object -First 1 -ExpandProperty IPAddress
  $mac = $_.MacAddress.ToLower().Replace('-', ':')
  $value = (@($ip, $mac) | Where-Object { $_ }) -join ' | '
  Emit ("Net " + $_.Name) $value
}
`

type Probe = { command: string; output: string }

export async function readWindows(detected: SystemId, choice: SystemChoice): Promise<ComputerReport> {
  const probe = await run("powershell", ["-NoProfile", "-NonInteractive", "-Command", SCRIPT])
  const built = describeWindows(usable(probe.output))
  const sections = built.sections.length > 0 || detected === "windows" ? built.sections : detectedFacts(detected)
  const notice = detected === "windows" ? undefined : `This computer is ${systemLabel(detected)}. These details were read with Windows commands. File actions still follow this computer.`
  return { detected, choice, system: "windows", notice, sections, commands: [shown(probe)] }
}

export function describeWindows(text: string): { sections: ComputerSection[] } {
  const fields = parseFields(text)
  const value = (key: string) => fields.find((item) => item.key === key)?.value ?? ""
  const sections = [
    section("This device", [
      fact("Computer", value("Computer")),
      fact("Vendor", value("Vendor")),
      fact("Model", value("Model")),
      fact("CPU", value("CPU")),
      fact("Architecture", value("Architecture")),
      fact("Cores", value("Cores")),
      fact("Memory", value("Memory")),
      fact("Serial number", value("Serial")),
    ]),
    section("Windows", [
      fact("Edition", value("Windows")),
      fact("Version", value("Version")),
      fact("Build", value("Build")),
      fact("User", value("User")),
      fact("Language", value("Language")),
      fact("Time zone", value("TimeZone")),
      fact("Running", value("Uptime")),
    ]),
    section("Memory", [fact("Total", value("Memory")), fact("Available", value("Available"))]),
    section("Storage", fields.filter((item) => item.key.startsWith("Volume ")).map((item) => volumeFact(item.key.slice("Volume ".length), item.value))),
    section("Network", fields.filter((item) => item.key.startsWith("Net ")).map((item) => fact(item.key.slice("Net ".length), item.value.replaceAll(" | ", " · ")))),
  ].filter((item) => item.facts.length > 0)
  return { sections }
}

function detectedFacts(detected: SystemId): ComputerSection[] {
  return [
    {
      title: "This device",
      facts: [
        { label: "Detected", value: systemLabel(detected) },
        { label: "Selected", value: "Windows" },
      ],
    },
  ]
}

function section(title: string, facts: Array<ComputerFact | null>): ComputerSection {
  return { title, facts: facts.filter((item): item is ComputerFact => item !== null) }
}

function fact(label: string, value: string, warn = false): ComputerFact | null {
  const trimmed = value.trim().replace(/[ \t]{2,}/g, " ")
  if (!trimmed) return null
  return warn ? { label, value: trimmed, warn: true } : { label, value: trimmed }
}

function volumeFact(label: string, value: string): ComputerFact | null {
  const percent = Number.parseInt(value.match(/(\d+)%$/)?.[1] ?? "", 10)
  return fact(label, value, Number.isFinite(percent) && percent >= 90)
}

function parseFields(text: string): Array<{ key: string; value: string }> {
  return text.split("\n").flatMap((line) => {
    const index = line.indexOf("=")
    if (index <= 0) return []
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim()
    return key && value ? [{ key, value }] : []
  })
}

async function run(file: string, args: string[]): Promise<Probe> {
  const command = `${file} ${args.slice(0, -1).join(" ")} <device script>`
  try {
    const { stdout, stderr } = await exec(file, args, { timeout: 20000, maxBuffer: 1_000_000, encoding: "utf8" })
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
  if (/ENOENT|command not found|No such file|not found|usage:/i.test(output)) return ""
  if (output.startsWith("Command failed")) return ""
  return output.trim()
}

function shown(probe: Probe): ComputerCommand {
  const output = usable(probe.output) ? probe.output : "Not available on this computer."
  return { command: probe.command, output: output.length > 8000 ? `${output.slice(0, 8000)}\n…` : output }
}
