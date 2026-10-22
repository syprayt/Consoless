import { baseName as pathBase, parentPath } from "./paths"

export const BLOCKED_NAMES = new Set([
  "unlink",
  "shutdown",
  "reboot",
  "halt",
  "poweroff",
  "dd",
  "diskutil",
  "sudo",
  "su",
  "doas",
  "kill",
  "killall",
  "pkill",
  "launchctl",
  "osascript",
  "chmod",
  "chown",
  "chgrp",
  "rsync",
  "pbcopy",
  "pbpaste",
])

export const INTERACTIVE_NAMES = new Set([
  "vim",
  "nvim",
  "nano",
  "emacs",
  "less",
  "more",
  "ssh",
  "sftp",
  "scp",
  "htop",
  "man",
])

const INTERPRETERS = /^(python\d*(\.\d+)*|node|ruby|perl|irb|php|lua|deno|bun)$/

const GIT_OK = new Set(["status", "--version", "diff", "branch", "remote", "log", "rev-parse"])

export type GuardResult = { ok: true; args: string[] } | { ok: false; error: string }

export function isBlockedName(name: string): boolean {
  return BLOCKED_NAMES.has(name) || name.startsWith("mkfs")
}

export function guardRun(name: string, input: string[], home = ""): GuardResult {
  if (name === "rm") return guardRemove(input, home)
  if (name === "rmdir") return guardEmptyDir(input, home)
  if (name === "cp" || name === "mv") return guardTransfer(input, home)
  if (name === "cat" || name === "head" || name === "tail") return guardRead(name, input)

  if (isBlockedName(name) || INTERACTIVE_NAMES.has(name)) {
    return { ok: false, error: "This command cannot be started from a button." }
  }

  let args = [...input]

  if (INTERPRETERS.test(name)) {
    if (args.length === 1 && (args[0] === "--version" || args[0] === "-V" || args[0] === "-v")) {
      return { ok: true, args }
    }
    return { ok: false, error: "Only the version can be shown for a language runtime." }
  }

  if (name === "ifconfig" && args.length !== 0) {
    return { ok: false, error: "Interfaces can be viewed, not reconfigured." }
  }

  if (name === "ping") {
    if (args.includes("-f")) return { ok: false, error: "Flood mode for ping is turned off." }
    if (!args.includes("-c")) args = ["-c", "4", ...args]
    const count = Number(args[args.indexOf("-c") + 1])
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      return { ok: false, error: "Ping is limited to ten packets." }
    }
    if (args.length < 3) return { ok: false, error: "An address is required." }
  }

  if (name === "top" && args[0] !== "-l") {
    return { ok: false, error: "Only a short snapshot is available, not a live screen." }
  }

  if (name === "find") {
    const banned = new Set(["-exec", "-execdir", "-delete", "-ok", "-okdir"])
    if (args.some((arg) => banned.has(arg)) || !args.includes("-maxdepth")) {
      return { ok: false, error: "Search can list folders. It cannot delete." }
    }
    const root = args[0] ?? ""
    if (root !== home && !isInsideHome(root, home)) {
      return { ok: false, error: "Search stays inside your home folder." }
    }
  }

  if (name === "softwareupdate" && !(args.length === 1 && args[0] === "-l")) {
    return { ok: false, error: "Only the update list can be checked." }
  }

  if (name === "networksetup" && args.join(" ") !== "-listallhardwareports") {
    return { ok: false, error: "Only the network ports can be shown." }
  }

  if (name === "curl" || name === "wget") {
    const writes = ["-o", "-O", "--output", "--remote-name", "-T", "--upload-file"]
    if (args.some((arg) => writes.includes(arg) || arg.startsWith("--output="))) {
      return { ok: false, error: "Saving the response to a file is turned off." }
    }
    if (!args.some((arg) => arg === "--max-time" || arg === "-m")) {
      args = ["--max-time", "8", ...args]
    }
  }

  if (name === "mkdir") {
    if (args.length !== 1 || args[0].startsWith("-") || args[0].includes("..") || !isInsideHome(args[0], home)) {
      return { ok: false, error: "Choose a folder in your home directory and a single name." }
    }
  }

  if (name === "ls") {
    const flag = args[0]
    const target = args[1] ?? ""
    if (args.length !== 2 || (flag !== "-1" && flag !== "-1p") || target.startsWith("-") || (target !== home && !isInsideHome(target, home))) {
      return { ok: false, error: "Choose one folder inside your home folder." }
    }
    return { ok: true, args }
  }

  if (name === "cd") {
    if (args.length !== 1 || args[0].startsWith("-") || (args[0] !== home && !isInsideHome(args[0], home))) {
      return { ok: false, error: "Choose one folder inside your home folder." }
    }
    return { ok: true, args }
  }

  if ((name === "echo" || name === "say") && (args.length !== 1 || args[0].length > 200)) {
    return { ok: false, error: "One short phrase is required." }
  }

  if (name === "open" && (args.length !== 1 || args[0].startsWith("-"))) {
    return { ok: false, error: "Choose one file or folder." }
  }

  if (name === "git" && !GIT_OK.has(args[0] ?? "")) {
    return { ok: false, error: "Status, history, and version can be shown." }
  }

  if ((name === "npm" || name === "npx" || name === "brew" || name === "pip3" || name === "pip" || name === "cargo") && args[0] !== "--version" && args[0] !== "-v") {
    return { ok: false, error: "Only the version can be shown." }
  }

  if (name === "go" && args[0] !== "version") {
    return { ok: false, error: "Only the version can be shown." }
  }

  if (name === "docker" && !["--version", "version", "ps"].includes(args[0] ?? "")) {
    return { ok: false, error: "The version or the container list can be shown." }
  }

  if (name === "ps" && args.some((arg) => arg.length > 80)) {
    return { ok: false, error: "Only a process snapshot is available." }
  }

  if (name === "df" && args.some((arg) => arg !== "-h" && arg !== "-H")) {
    return { ok: false, error: "Only free disk space can be shown." }
  }

  if (name === "mdfind" && (args.length !== 1 || args[0].length > 200)) {
    return { ok: false, error: "One search phrase is required." }
  }

  if (name === "du") {
    const target = args[2] ?? ""
    if (args.length !== 3 || args[0] !== "-s" || args[1] !== "-h" || target.startsWith("-") || (target !== home && !isInsideHome(target, home))) {
      return { ok: false, error: "Choose one folder inside your home folder." }
    }
    return { ok: true, args }
  }

  if (name === "file") {
    const target = args[1] ?? ""
    if (args.length !== 2 || args[0] !== "-b" || target.startsWith("-") || (target !== home && !isInsideHome(target, home))) {
      return { ok: false, error: "Choose one file or folder inside your home folder." }
    }
    return { ok: true, args }
  }

  if (name === "stat") {
    const target = args[1] ?? ""
    if (args.length !== 2 || args[0] !== "-x" || target.startsWith("-") || (target !== home && !isInsideHome(target, home))) {
      return { ok: false, error: "Choose one file or folder inside your home folder." }
    }
    return { ok: true, args }
  }

  if (name === "wc") {
    const target = args[0] ?? ""
    if (args.length !== 1 || target.startsWith("-") || !isInsideHome(target, home)) {
      return { ok: false, error: "Choose one file inside your home folder." }
    }
    return { ok: true, args }
  }

  if (name === "touch") {
    const target = args[0] ?? ""
    if (args.length !== 1 || target.startsWith("-") || target.includes("..") || !isInsideHome(target, home)) {
      return { ok: false, error: "Choose a new file name in your home folder." }
    }
    return { ok: true, args }
  }

  if (name === "dig" || name === "nslookup" || name === "host" || name === "traceroute" || name === "which") {
    if (args.length !== 1 || !/^[A-Za-z0-9.:_-]+$/.test(args[0])) {
      return { ok: false, error: "One name is required, without spaces." }
    }
    return { ok: true, args }
  }

  const archived = guardArchive(name, args, home)
  if (archived) return archived

  if (CHECKED.has(name) || PLAIN_OK.has(name)) return { ok: true, args }
  return { ok: false, error: "This command has a card and a manual, and no run button yet." }
}

function guardArchive(name: string, args: string[], home: string): GuardResult | null {
  if (name === "zip") {
    const dest = args[2] ?? ""
    const sources = args.slice(3)
    const parent = directoryOf(sources[0] ?? "")
    const packed =
      args[0] === "-r" &&
      args[1] === "-X" &&
      sources.length >= 1 &&
      sources.length <= 20 &&
      dest.endsWith(".zip") &&
      isInsideHome(dest, home) &&
      Boolean(parent) &&
      sources.every((item) => isInsideHome(item, home) && directoryOf(item) === parent && !baseName(item).startsWith("-"))
    return packed
      ? { ok: true, args }
      : { ok: false, error: "Choose items from one folder and a new zip in your home folder." }
  }

  if (name === "unzip") {
    const dest = args[2] ?? ""
    const archive = args[3] ?? ""
    const packed = args[0] === "-n" && args[1] === "-d" && args.length === 4 && isInsideHome(dest, home) && isInsideHome(archive, home) && archive.toLowerCase().endsWith(".zip")
    return packed
      ? { ok: true, args }
      : { ok: false, error: "Choose a zip file and a new folder inside your home folder." }
  }

  if (name === "tar" && args[0] === "-czf") {
    const dest = args[1] ?? ""
    const root = args[3] ?? ""
    const names = args.slice(4)
    const packed =
      args[2] === "-C" &&
      dest.endsWith(".tar.gz") &&
      isInsideHome(dest, home) &&
      (root === home || isInsideHome(root, home)) &&
      names.length >= 1 &&
      names.length <= 20 &&
      names.every((item) => plainName(item))
    return packed
      ? { ok: true, args }
      : { ok: false, error: "Choose items from one folder and a new archive in your home folder." }
  }

  if (name === "tar" && args[0] === "-xf") {
    const archive = args[1] ?? ""
    const dest = args[3] ?? ""
    const lower = archive.toLowerCase()
    const packed =
      args[2] === "-C" &&
      args.length === 4 &&
      isInsideHome(archive, home) &&
      isInsideHome(dest, home) &&
      (lower.endsWith(".tar") || lower.endsWith(".tar.gz") || lower.endsWith(".tgz"))
    return packed
      ? { ok: true, args }
      : { ok: false, error: "Choose a tar archive and a new folder inside your home folder." }
  }

  if (name === "gzip") {
    const file = args[2] ?? ""
    return args[0] === "-k" && args[1] === "-n" && args.length === 3 && isInsideHome(file, home)
      ? { ok: true, args }
      : { ok: false, error: "Choose one file inside your home folder." }
  }

  if (name === "gunzip") {
    const file = args[1] ?? ""
    return args[0] === "-k" && args.length === 2 && file.toLowerCase().endsWith(".gz") && isInsideHome(file, home)
      ? { ok: true, args }
      : { ok: false, error: "Choose a .gz file inside your home folder." }
  }

  if (name === "bzip2" && args[0] === "-k") {
    const file = args[1] ?? ""
    return args.length === 2 && isInsideHome(file, home)
      ? { ok: true, args }
      : { ok: false, error: "Choose one file inside your home folder." }
  }

  if (name === "bzip2" && args[0] === "-d") {
    const file = args[2] ?? ""
    return args[1] === "-k" && args.length === 3 && file.toLowerCase().endsWith(".bz2") && isInsideHome(file, home)
      ? { ok: true, args }
      : { ok: false, error: "Choose a .bz2 file inside your home folder." }
  }

  if (name === "zip" || name === "unzip" || name === "tar" || name === "gzip" || name === "gunzip" || name === "bzip2") {
    return { ok: false, error: "Choose files inside your home folder." }
  }
  return null
}

function directoryOf(value: string): string {
  return parentPath(value)
}

function baseName(value: string): string {
  return pathBase(value)
}

function plainName(value: string): boolean {
  return Boolean(value) && value !== "." && value !== ".." && !value.startsWith("-") && !value.includes("/") && !value.includes("\\") && !value.includes("\0")
}

function guardRemove(args: string[], home: string): GuardResult {
  const recursive = args[0] === "-r"
  const paths = recursive ? args.slice(1) : args
  if (paths.length < 1 || paths.length > 30 || paths.some((item) => !isInsideHome(item, home))) {
    return { ok: false, error: "Choose files or folders inside your home folder." }
  }
  return { ok: true, args }
}

function guardEmptyDir(args: string[], home: string): GuardResult {
  if (args.length !== 1 || !isInsideHome(args[0], home)) {
    return { ok: false, error: "Choose one empty folder inside your home folder." }
  }
  return { ok: true, args }
}

function guardTransfer(args: string[], home: string): GuardResult {
  if (args.length < 2 || args.some((item) => item.startsWith("-") || !isAbsoluteTarget(item))) {
    return { ok: false, error: "Choose files and a destination folder." }
  }
  const destination = args[args.length - 1] ?? ""
  if (destination !== home && !isInsideHome(destination, home)) {
    return { ok: false, error: "The destination has to be inside your home folder." }
  }
  return { ok: true, args }
}

function guardRead(name: string, args: string[]): GuardResult {
  if (name === "cat" && args.length === 1 && isAbsoluteTarget(args[0] ?? "")) return { ok: true, args }
  if ((name === "head" || name === "tail") && args.length === 3 && args[0] === "-n" && /^\d+$/.test(args[1] ?? "") && Number(args[1]) <= 200 && isAbsoluteTarget(args[2] ?? "")) {
    return { ok: true, args }
  }
  return { ok: false, error: "Choose one file." }
}

export function isInsideHome(value: string, home: string): boolean {
  if (!home || !value || value.includes("\0") || value.split(/[/\\]/).includes("..")) return false
  if (isWindowsPath(value) || isWindowsPath(home)) return insideWindowsHome(value, home)
  if (!value.startsWith("/")) return false
  const prefix = home.endsWith("/") ? home : `${home}/`
  return value.startsWith(prefix) && value !== home
}

function isAbsoluteTarget(value: string): boolean {
  return value.startsWith("/") || isWindowsPath(value)
}

function isWindowsPath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value)
}

function insideWindowsHome(value: string, home: string): boolean {
  const file = windowsKey(value)
  const root = windowsKey(home)
  if (!file || !root || file === root) return false
  return file.startsWith(`${root}\\`)
}

function windowsKey(value: string): string {
  if (!isWindowsPath(value)) return ""
  return value.replaceAll("/", "\\").replace(/\\+$/, "").toLowerCase()
}

const CHECKED = new Set([
  "ifconfig",
  "ping",
  "top",
  "find",
  "softwareupdate",
  "networksetup",
  "curl",
  "wget",
  "mkdir",
  "cd",
  "echo",
  "say",
  "open",
  "git",
  "npm",
  "npx",
  "brew",
  "pip3",
  "pip",
  "cargo",
  "go",
  "docker",
  "ps",
  "df",
  "mdfind",
])

const PLAIN_OK = new Set([
  "ls",
  "pwd",
  "df",
  "date",
  "whoami",
  "uname",
  "uptime",
  "sw_vers",
  "hostname",
  "id",
  "ps",
  "netstat",
  "arp",
  "route",
  "printenv",
  "alias",
  "history",
  "export",
  "popd",
  "pushd",
])

export function plainRunnable(name: string): boolean {
  return PLAIN_OK.has(name)
}

export function versionArgs(name: string): string[] | null {
  if (INTERPRETERS.test(name)) return ["--version"]
  if (name === "pip3" || name === "pip" || name === "npm" || name === "npx" || name === "brew" || name === "cargo") {
    return ["--version"]
  }
  if (name === "go") return ["version"]
  if (name === "docker") return ["--version"]
  return null
}
