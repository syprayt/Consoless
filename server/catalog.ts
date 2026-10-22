import { execFile, execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { categoryOf } from "../shared/classify"
import { computerPhrase, detectSystem, hostShell } from "../shared/device"
import { isWindowsFileCommand, WINDOWS_FILE_COMMANDS, windowsFileLaunch } from "../shared/windows-files"
import { KNOWN } from "../shared/known"
import { BLOCKED_NAMES, guardRun, INTERACTIVE_NAMES, isBlockedName, isInsideHome } from "../shared/policy"
import type { Catalog, CommandInfo, RunResult } from "../shared/types"
import { manualSummary } from "./manual"

const exec = promisify(execFile)

const BUILTINS = ["cd", "alias", "history", "export", "source", "pushd", "popd"]

const NAME_OK = /^[A-Za-z0-9._+-]+$/

export function buildCatalog(): Catalog {
  const home = os.homedir()
  const seen = new Set<string>()
  const commands: CommandInfo[] = []
  const builtins = new Set(installedBuiltins())

  for (const dir of uniquePathDirs()) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.isDirectory()) continue
      const fileName = entry.name
      const name = commandName(fileName)
      if (!NAME_OK.test(fileName) || !NAME_OK.test(name) || seen.has(name)) continue
      if (builtins.has(name)) {
        seen.add(name)
        commands.push(describe(name, "builtin", ""))
        continue
      }
      const full = path.join(dir, fileName)
      if (!canRunFile(fileName, full)) continue
      seen.add(name)
      commands.push(describe(name, "program", full))
    }
  }

  for (const name of installedBuiltins()) {
    if (seen.has(name) || !KNOWN[name]) continue
    seen.add(name)
    commands.push(describe(name, "builtin", ""))
  }

  if (process.platform === "win32") {
    for (const name of WINDOWS_FILE_COMMANDS) {
      const index = commands.findIndex((item) => item.name === name)
      if (index >= 0) commands[index] = { ...commands[index], kind: "program", path: "" }
      else commands.push(describe(name, "program", ""))
    }
  }

  commands.sort((a, b) => a.name.localeCompare(b.name, "en"))
  return { hostname: os.hostname(), home, system: detectSystem(process.platform), commands }
}

export function describeCommand(name: string): { manual: string | null } {
  return { manual: manualSummary(name) }
}

export async function runCommand(
  catalog: Catalog,
  name: string,
  args: string[],
): Promise<RunResult> {
  if (!NAME_OK.test(name)) {
    return failure("Unknown command.", [])
  }
  if (!Array.isArray(args) || args.length > 40 || args.some((arg) => typeof arg !== "string" || arg.length > 4096 || arg.includes("\0"))) {
    return failure("Those arguments cannot be used.", [name])
  }

  const command = catalog.commands.find((item) => item.name === name)
  if (!command) return failure(`That command is not on ${computerPhrase(detectSystem(process.platform))}.`, [name])
  if (command.blocked || command.interactive) return failure("This command cannot be started from a button.", [name])

  const guarded = guardRun(name, args, catalog.home)
  if (!guarded.ok) return failure(guarded.error, [name, ...args])
  const problem = inspectPaths(name, guarded.args, catalog.home)
  if (problem) return failure(problem, [name, ...guarded.args])
  const argv = [name, ...guarded.args]
  const windows = process.platform === "win32" && isWindowsFileCommand(name) ? windowsFileLaunch(name, guarded.args) : null
  if (windows && "error" in windows) return failure(windows.error, argv)
  const prepared = windows ? { args: guarded.args, cwd: catalog.home } : await prepareArchive(catalog, name, guarded.args, catalog.home)
  if (typeof prepared === "string") return failure(prepared, argv)
  try {
    const { stdout, stderr } = await exec(
      windows ? "powershell.exe" : spawnFile(command),
      windows ? ["-NoProfile", "-NonInteractive", "-Command", windows.script] : spawnArgs(command, prepared.args, catalog.home),
      windows ? { ...options(prepared.cwd, name), env: { ...process.env, TERM: "dumb", PAGER: "cat", ...windows.env } } : options(prepared.cwd, name),
    )
    if (prepared.created) {
      const escaped = auditExtract(prepared.created, catalog.home)
      if (escaped) {
        fs.rmSync(prepared.created, { recursive: true, force: true })
        return failure(escaped, argv)
      }
    }
    return {
      ok: true,
      code: 0,
      stdout: clip(stdout),
      stderr: clip(stderr),
      timedOut: false,
      argv,
    }
  } catch (error) {
    if (prepared.created) fs.rmSync(prepared.created, { recursive: true, force: true })
    const caught = error as NodeJS.ErrnoException & {
      stdout?: string
      stderr?: string
      killed?: boolean
      code?: number | string
    }
    return {
      ok: false,
      code: typeof caught.code === "number" ? caught.code : 1,
      stdout: clip(caught.stdout ?? ""),
      stderr: clip(caught.stderr || caught.message),
      timedOut: Boolean(caught.killed),
      argv,
    }
  }
}

function describe(name: string, kind: "program" | "builtin", fullPath: string): CommandInfo {
  const known = KNOWN[name]
  return {
    name,
    title: known?.title ?? name,
    summary: known?.summary ?? "",
    category: categoryOf(name),
    known: Boolean(known),
    kind,
    path: fullPath,
    blocked: Boolean(known?.blocked) || isBlockedName(name) || BLOCKED_NAMES.has(name),
    interactive: Boolean(known?.interactive) || INTERACTIVE_NAMES.has(name),
    note: known?.note ?? null,
  }
}

function uniquePathDirs(): string[] {
  return splitPathEnv(process.platform, process.env.PATH ?? "", os.homedir())
}

export function splitPathEnv(platform: string, raw: string, home: string): string[] {
  const separator = platform === "win32" ? ";" : ":"
  return [...new Set(raw.split(separator).filter(Boolean).map((dir) => (dir.startsWith("~/") ? path.join(home, dir.slice(2)) : dir)))]
}

export function commandBaseName(platform: string, fileName: string, pathExt = ".COM;.EXE;.BAT;.CMD"): string {
  if (platform !== "win32") return fileName
  const extension = path.extname(fileName)
  const extensions = pathExt.split(";").filter(Boolean).map((item) => item.toLowerCase())
  return extensions.includes(extension.toLowerCase()) ? fileName.slice(0, -extension.length) : fileName
}

function commandName(fileName: string): string {
  return commandBaseName(process.platform, fileName, process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
}

function canRunFile(fileName: string, full: string): boolean {
  if (process.platform === "win32") return pathExtensions().includes(path.extname(fileName).toLowerCase())
  try {
    fs.accessSync(full, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

function pathExtensions(): string[] {
  return (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean).map((item) => item.toLowerCase())
}

function installedBuiltins(): string[] {
  const shell = hostShell(process.platform)
  if (!shell) return []
  try {
    const script = shell === "zsh"
      ? 'for n; do whence -w "$n"; done'
      : 'for n; do t=$(type -t "$n" 2>/dev/null || true); printf "%s:%s\\n" "$n" "$t"; done'
    const output = execFileSync(shell, ["-c", script, shell, ...BUILTINS], { encoding: "utf8", timeout: 4000 })
    return parseBuiltinReport(output)
  } catch {
    return []
  }
}

export function parseBuiltinReport(output: string): string[] {
  return output.split("\n").flatMap((line) => {
    const match = line.match(/^([A-Za-z0-9._+-]+)\s*:\s*(builtin|function)\b/)
    return match?.[1] ? [match[1]] : []
  })
}

function spawnFile(command: CommandInfo): string {
  return command.kind === "builtin" ? hostShell(process.platform) ?? "bash" : command.path
}

function spawnArgs(command: CommandInfo, args: string[], home: string): string[] {
  const shell = hostShell(process.platform) ?? "bash"
  if (command.kind === "builtin" && command.name === "cd") {
    return ["-c", 'cd -- "$1" && pwd', shell, args[0] || home]
  }
  if (command.kind === "builtin") {
    return ["-c", 'builtin "$1" "${@:2}"', shell, command.name, ...args]
  }
  return args
}

function options(cwd: string, name: string) {
  const longer = name === "rm" || name === "cp" || name === "mv" || name === "du" || name === "zip" || name === "unzip" || name === "tar" || name === "gzip" || name === "gunzip" || name === "bzip2"
  return {
    timeout: longer ? 30_000 : 8000,
    maxBuffer: 1_000_000,
    cwd,
    env: { ...process.env, TERM: "dumb", PAGER: "cat" },
  }
}

function inspectPaths(name: string, args: string[], home: string): string | null {
  if (name === "rm") return inspectRemove(args, home)
  if (name === "rmdir") return inspectEmpty(args, home)
  if (name === "cp" || name === "mv") return inspectTransfer(name, args, home)
  if (name === "cat" || name === "head" || name === "tail") return inspectRead(args, home)
  if (name === "mkdir") return inspectMkdir(args, home)
  if (name === "cd") return inspectDirectory(args[0] ?? "", home)
  if (name === "ls") return inspectDirectory(args[1] ?? "", home)
  if (name === "du") return inspectExisting(args[2] ?? "", home)
  if (name === "file" || name === "stat") return inspectExisting(args[1] ?? "", home)
  if (name === "wc") return inspectWc(args, home)
  if (name === "touch") return inspectTouch(args, home)
  if (name === "zip") return inspectZip(args, home)
  if (name === "unzip") return inspectUnpack(args[3] ?? "", args[2] ?? "", home, 200_000_000)
  if (name === "tar" && args[0] === "-czf") return inspectTarPack(args, home)
  if (name === "tar" && args[0] === "-xf") return inspectUnpack(args[1] ?? "", args[3] ?? "", home, 200_000_000)
  if (name === "gzip") return inspectCompress(args[2] ?? "", home, ".gz")
  if (name === "gunzip") return inspectRestore(args[1] ?? "", home, ".gz")
  if (name === "bzip2" && args[0] === "-k") return inspectCompress(args[1] ?? "", home, ".bz2")
  if (name === "bzip2" && args[0] === "-d") return inspectRestore(args[2] ?? "", home, ".bz2")
  return null
}

function inspectExisting(target: string, home: string): string | null {
  const found = target === home ? resolveExisting(target) : resolveInsideHome(target, home)
  if (typeof found === "string") return found
  return null
}

function inspectWc(args: string[], home: string): string | null {
  const found = resolveInsideHome(args[0] ?? "", home)
  if (typeof found === "string") return found
  if (found.directory) return "Choose a file."
  if (found.size > 2_000_000) return "That file is too large to count here."
  return null
}

function inspectTouch(args: string[], home: string): string | null {
  const target = args[0] ?? ""
  const parent = path.dirname(target)
  const found = parent === home ? resolveExisting(parent) : resolveInsideHome(parent, home)
  if (typeof found === "string") return found
  if (!found.directory) return "Choose a folder."
  if (fs.existsSync(target)) return "That file already exists."
  return null
}

function inspectDirectory(target: string, home: string): string | null {
  const found = target === home ? resolveExisting(target) : resolveInsideHome(target, home)
  if (typeof found === "string") return found
  if (!found.directory) return "Choose a folder."
  return null
}

function inspectRemove(args: string[], home: string): string | null {
  const recursive = args[0] === "-r"
  const paths = recursive ? args.slice(1) : args
  for (const item of paths) {
    const found = resolveInsideHome(item, home)
    if (typeof found === "string") return found
    if (found.directory && !recursive) return "A folder is included. Pick it again so its contents can be removed too."
  }
  return null
}

function inspectEmpty(args: string[], home: string): string | null {
  const found = resolveInsideHome(args[0] ?? "", home)
  if (typeof found === "string") return found
  if (!found.directory) return "Choose a folder."
  if (fs.readdirSync(found.real).length > 0) return "That folder is not empty."
  return null
}

function inspectTransfer(name: string, args: string[], home: string): string | null {
  const destinationInput = args[args.length - 1] ?? ""
  const destination = destinationInput === home ? resolveExisting(destinationInput) : resolveInsideHome(destinationInput, home)
  if (typeof destination === "string") return destination
  if (!destination.directory) return "Choose a destination folder."
  for (const source of args.slice(0, -1)) {
    const found = name === "mv" ? resolveInsideHome(source, home) : resolveExisting(source)
    if (typeof found === "string") return found
    if (found.real === destination.real) return "The destination is the same as the source."
  }
  return null
}

function inspectRead(args: string[], home: string): string | null {
  const file = args[args.length - 1] ?? ""
  const found = resolveExisting(file)
  if (typeof found === "string") return found
  if (!isInsideHome(found.real, home)) return "Choose a file inside your home folder."
  if (found.directory) return "Choose a file."
  if (found.size > 300_000) return "That file is too large to show here."
  return null
}

function inspectMkdir(args: string[], home: string): string | null {
  const target = args[0] ?? ""
  const parent = path.dirname(target)
  const found = resolveExisting(parent)
  if (typeof found === "string") return found
  if (found.real !== home && !isInsideHome(found.real, home)) return "Choose a parent folder in your home folder."
  if (!found.directory) return "Choose a parent folder."
  if (fs.existsSync(target)) return "That folder already exists."
  return null
}

const ARCHIVE_LIMIT = 200_000_000

function inspectZip(args: string[], home: string): string | null {
  const dest = args[2] ?? ""
  const sources = args.slice(3)
  if (fs.existsSync(dest)) return "That archive already exists."
  const parent = path.dirname(dest)
  const folder = parent === home ? resolveExisting(parent) : resolveInsideHome(parent, home)
  if (typeof folder === "string") return folder
  if (!folder.directory) return "Choose a folder."
  for (const source of sources) {
    const problem = packable(source, home)
    if (problem) return problem
    if (path.basename(source) === path.basename(dest) && path.dirname(source) === path.dirname(dest)) return "The archive can't include itself."
  }
  return null
}

function inspectTarPack(args: string[], home: string): string | null {
  const dest = args[1] ?? ""
  const root = args[3] ?? ""
  const names = args.slice(4)
  if (fs.existsSync(dest)) return "That archive already exists."
  const folder = root === home ? resolveExisting(root) : resolveInsideHome(root, home)
  if (typeof folder === "string") return folder
  if (!folder.directory) return "Choose a folder."
  for (const item of names) {
    const problem = packable(path.join(root, item), home)
    if (problem) return problem
  }
  if (names.includes(path.basename(dest)) && path.dirname(dest) === root) return "The archive can't include itself."
  return null
}

function inspectUnpack(archive: string, dest: string, home: string, limit: number): string | null {
  const file = resolveInsideHome(archive, home)
  if (typeof file === "string") return file
  if (file.directory) return "Choose an archive file."
  if (file.size > limit) return "That archive is too large."
  if (fs.existsSync(dest)) return "That folder already exists."
  const parent = path.dirname(dest)
  const folder = parent === home ? resolveExisting(parent) : resolveInsideHome(parent, home)
  if (typeof folder === "string") return folder
  if (!folder.directory) return "Choose a folder."
  return null
}

function inspectCompress(file: string, home: string, suffix: string): string | null {
  const found = resolveInsideHome(file, home)
  if (typeof found === "string") return found
  if (found.directory) return "Choose a file."
  if (found.size > ARCHIVE_LIMIT) return "That file is too large."
  if (fs.existsSync(file + suffix)) return "That compressed file already exists."
  return null
}

function inspectRestore(file: string, home: string, suffix: string): string | null {
  const found = resolveInsideHome(file, home)
  if (typeof found === "string") return found
  if (found.directory) return "Choose a file."
  if (found.size > ARCHIVE_LIMIT) return "That file is too large."
  const output = file.slice(0, -suffix.length)
  if (!isInsideHome(output, home)) return "Choose a file inside your home folder."
  if (fs.existsSync(output)) return "That file already exists."
  return null
}

function packable(target: string, home: string): string | null {
  let stat: fs.Stats
  try {
    stat = fs.lstatSync(target)
  } catch {
    return "That item could not be found."
  }
  if (stat.isSymbolicLink()) return "A link can't be packed."
  const found = resolveInsideHome(target, home)
  if (typeof found === "string") return found
  if (!stat.isDirectory()) return null
  const stack = [target]
  let count = 0
  while (stack.length > 0) {
    const current = stack.pop() ?? ""
    let children: string[]
    try {
      children = fs.readdirSync(current)
    } catch {
      return "That folder could not be read."
    }
    for (const item of children) {
      count += 1
      if (count > 5000) return "That folder has too many items to pack."
      const child = path.join(current, item)
      let childStat: fs.Stats
      try {
        childStat = fs.lstatSync(child)
      } catch {
        return "That item could not be found."
      }
      if (childStat.isSymbolicLink()) return "A link can't be packed."
      const inner = resolveInsideHome(child, home)
      if (typeof inner === "string") return inner
      if (childStat.isDirectory()) stack.push(child)
    }
  }
  return null
}

type Prepared = { args: string[]; cwd: string; created?: string }

async function prepareArchive(catalog: Catalog, name: string, args: string[], home: string): Promise<Prepared | string> {
  if (name === "zip") {
    const dest = args[2] ?? ""
    const sources = args.slice(3)
    return { args: ["-r", "-X", dest, ...sources.map((item) => path.basename(item))], cwd: path.dirname(sources[0] ?? home) }
  }
  if (name === "unzip" || (name === "tar" && args[0] === "-xf")) {
    const archive = name === "unzip" ? args[3] ?? "" : args[1] ?? ""
    const dest = name === "unzip" ? args[2] ?? "" : args[3] ?? ""
    const tool = catalog.commands.find((item) => item.name === (name === "unzip" ? "unzip" : "tar"))
    if (!tool?.path) return `That command is not on ${computerPhrase(detectSystem(process.platform))}.`
    try {
      const { stdout } = await exec(tool.path, name === "unzip" ? ["-Z1", archive] : ["-tf", archive], { timeout: 8000, maxBuffer: 1_000_000, cwd: home })
      const lines = stdout
        .split("\n")
        .map((line) => line.replace(/\/+$/, "").trim())
        .filter(Boolean)
      if (lines.length === 0) return "That archive is empty."
      if (lines.length > 5000) return "That archive has too many files."
      if (lines.some(unsafeEntry)) return "That archive contains a path that leaves its folder."
    } catch {
      return "That archive could not be read."
    }
    fs.mkdirSync(dest)
    return { args, cwd: home, created: dest }
  }
  return { args, cwd: home }
}

function unsafeEntry(name: string): boolean {
  if (!name || name.startsWith("/") || name.includes("\\") || name.includes("\0")) return true
  return name.split("/").some((part) => part === "" || part === "." || part === "..")
}

function auditExtract(dest: string, home: string): string | null {
  let root = ""
  try {
    root = fs.realpathSync(dest)
  } catch {
    return "That folder could not be read."
  }
  if (root !== home && !isInsideHome(root, home)) return "That folder is outside your home folder."
  const stack = [dest]
  let count = 0
  while (stack.length > 0) {
    const current = stack.pop() ?? ""
    let stat: fs.Stats
    try {
      stat = fs.lstatSync(current)
    } catch {
      return "That archive could not be checked."
    }
    if (stat.isSymbolicLink()) return "That archive contains a link."
    let real = ""
    try {
      real = fs.realpathSync(current)
    } catch {
      return "That archive could not be checked."
    }
    if (real !== root && !real.startsWith(`${root}/`)) return "That archive leaves its folder."
    count += 1
    if (count > 5000) return "That archive has too many files."
    if (stat.isDirectory()) {
      for (const item of fs.readdirSync(current)) stack.push(path.join(current, item))
    }
  }
  return null
}

function resolveInsideHome(input: string, home: string): { real: string; directory: boolean; size: number } | string {
  const found = resolveExisting(input)
  if (typeof found === "string") return found
  if (!isInsideHome(found.real, home)) return "That item is outside your home folder."
  return found
}

function resolveExisting(input: string): { real: string; directory: boolean; size: number } | string {
  try {
    const real = fs.realpathSync(input)
    const stat = fs.statSync(real)
    return { real, directory: stat.isDirectory(), size: stat.size }
  } catch {
    return "That item could not be found."
  }
}

function clip(text: string): string {
  if (text.length <= 20_000) return text
  return `${text.slice(0, 20_000)}\n… output truncated …`
}

function failure(error: string, argv: string[]): RunResult {
  return { ok: false, code: 1, stdout: "", stderr: "", timedOut: false, argv, error }
}
