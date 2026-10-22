import { joinChild } from "./folder"
import { baseName, parentPath } from "../shared/paths"
import { plainRunnable, versionArgs } from "../shared/policy"

export type Field = {
  key: string
  label: string
  placeholder: string
}

export type Picked = {
  path: string
  directory: boolean
}

export type FilePick = {
  key: string
  label: string
  kind: "file" | "folder" | "either"
  multiple?: boolean
}

export type Action = {
  id: string
  label: string
  hint?: string
  tone?: "danger"
  fields?: Field[]
  picks?: FilePick[]
  args?: string[]
  build?: (values: Record<string, string>, picks: Record<string, Picked[]>) => string[] | null
}

export function actionsFor(name: string, home: string, folder = home): Action[] {
  const specific = specificActions(name, folder)
  if (specific) return specific
  const version = versionArgs(name)
  if (version) return [{ id: "version", label: "Show version", args: version }]
  if (plainRunnable(name)) return [{ id: "show", label: "Show", args: [] }]
  return []
}

export function canRun(name: string, blocked: boolean, interactive: boolean, home: string, folder = home): boolean {
  if (blocked || interactive) return false
  return actionsFor(name, home, folder).length > 0
}

export function resolveArgs(action: Action, values: Record<string, string>, picks: Record<string, Picked[]>): string[] | null {
  if (action.build) return action.build(values, picks)
  return action.args ?? []
}

function specificActions(name: string, folder: string): Action[] | null {
  switch (name) {
    case "ifconfig":
      return [{ id: "show", label: "Show interfaces", args: [] }]
    case "ping":
      return [fieldAction("ping", "Send 4 packets", "Address", "apple.com", (host) => (isHost(host) ? ["-c", "4", host] : null))]
    case "curl":
      return [fieldAction("curl", "Open address", "Address", "https://example.com", (url) => (url && !/\s/.test(url) ? ["--max-time", "8", "-L", url] : null))]
    case "wget":
      return [fieldAction("wget", "Open address", "Address", "https://example.com", (url) => (url && !/\s/.test(url) ? ["--max-time", "8", url] : null))]
    case "dig":
    case "nslookup":
    case "host":
    case "traceroute":
    case "which":
      return [fieldAction(name, "Look up", "Name", name === "which" ? "ls" : "apple.com", (host) => (isHost(host) ? [host] : null))]
    case "networksetup":
      return [{ id: "ports", label: "Show ports", args: ["-listallhardwareports"] }]
    case "ls":
      return [
        {
          id: "here",
          label: "Show this folder",
          hint: "Lists the working folder. Open, Copy, Move, and Delete are on each name there.",
          args: ["-1p", folder],
        },
        {
          id: "folder",
          label: "Choose folder",
          picks: [{ key: "dir", label: "Choose folder", kind: "folder" }],
          build: (_values, picks) => (picks.dir?.[0] ? ["-1p", picks.dir[0].path] : null),
        },
      ]
    case "pwd":
      return [{ id: "show", label: "Where am I", args: [] }]
    case "cd":
      return [
        {
          id: "cd",
          label: "Go",
          hint: "The folder you choose becomes the working folder.",
          picks: [{ key: "dir", label: "Choose folder", kind: "folder" }],
          build: (_values, picks) => (picks.dir?.[0] ? [picks.dir[0].path] : null),
        },
      ]
    case "mkdir":
      return [
        {
          id: "mkdir",
          label: "Create folder",
          hint: "The new folder is created in the working folder.",
          fields: [{ key: "mkdir", label: "Folder name", placeholder: "Notes" }],
          build: (values) => {
            const target = joinChild(folder, values.mkdir ?? "")
            return target ? [target] : null
          },
        },
      ]
    case "open":
      return [
        { id: "folder", label: "Open this folder", args: [folder] },
        {
          id: "choose",
          label: "Open",
          picks: [{ key: "target", label: "Choose file or folder", kind: "either" }],
          build: (_values, picks) => (picks.target?.[0] ? [picks.target[0].path] : null),
        },
      ]
    case "find":
      return [{ id: "here", label: "Show folders here", args: [folder, "-maxdepth", "1"] }]
    case "mdfind":
      return [fieldAction("mdfind", "Search this Mac", "What to find", "notes", (query) => (query ? [query] : null))]
    case "rm":
      return [
        {
          id: "rm",
          label: "Delete",
          tone: "danger",
          hint: confirmHint(
            "Pick items in the file window. A Mac alert asks you to confirm before anything is removed.",
            "Pick items in the file window. An alert asks you to confirm before anything is removed.",
          ),
          picks: [{ key: "targets", label: "Choose files or folders", kind: "either", multiple: true }],
          build: (_values, picks) => removeArgs(picks.targets ?? []),
        },
      ]
    case "rmdir":
      return [
        {
          id: "rmdir",
          label: "Remove empty folder",
          tone: "danger",
          hint: confirmHint(
            "The folder has to be empty. A Mac alert asks you to confirm.",
            "The folder has to be empty. An alert asks you to confirm before anything is removed.",
          ),
          picks: [{ key: "dir", label: "Choose empty folder", kind: "folder" }],
          build: (_values, picks) => (picks.dir?.[0] ? [picks.dir[0].path] : null),
        },
      ]
    case "cp":
      return [transferAction("cp", "Copy")]
    case "mv":
      return [transferAction("mv", "Move")]
    case "cat":
      return [fileRead("cat", "Show file", "Shows the file you pick.", (file) => [file])]
    case "head":
      return [fileRead("head", "Show the start", "Shows the first lines of the file you pick.", (file) => ["-n", "40", file])]
    case "tail":
      return [fileRead("tail", "Show the end", "Shows the last lines of the file you pick.", (file) => ["-n", "40", file])]
    case "du":
      return [
        {
          id: "size",
          label: "Size of this folder",
          hint: "Measures the working folder, including everything inside it.",
          args: ["-s", "-h", folder],
        },
      ]
    case "file":
      return [
        { id: "here", label: "This folder", hint: "Tells what this folder is.", args: ["-b", folder] },
        fileRead("file", "Choose file", "Reads the file you pick from the working folder.", (file) => ["-b", file]),
      ]
    case "stat":
      return [
        { id: "here", label: "This folder", hint: "Size, dates, and permissions for this folder.", args: ["-x", folder] },
        fileRead("stat", "Choose file", "Reads the file you pick from the working folder.", (file) => ["-x", file]),
      ]
    case "touch":
      return [
        {
          id: "touch",
          label: "Create file",
          hint: "Creates an empty file in the working folder. An existing name is left alone.",
          fields: [{ key: "touch", label: "File name", placeholder: "notes.txt" }],
          build: (values) => {
            const target = joinChild(folder, values.touch ?? "")
            return target ? [target] : null
          },
        },
      ]
    case "wc":
      return [fileRead("wc", "Count lines", "Counts the file you pick from the working folder.", (file) => [file])]
    case "zip":
      return [
        {
          id: "zip",
          label: "Pack",
          hint: "Packs items from one folder into a new zip in the working folder.",
          fields: [{ key: "zip", label: "Archive name", placeholder: "Photos" }],
          picks: [{ key: "sources", label: "Choose files or folders", kind: "either", multiple: true }],
          build: (values, picks) => packSources(folder, values.zip ?? "", ".zip", picks.sources ?? [], (dest, root, names) => ["-r", "-X", dest, ...names.map((name) => `${root}/${name}`)]),
        },
      ]
    case "unzip":
      return [
        {
          id: "unzip",
          label: "Unpack",
          hint: "Unpacks a zip into a new folder in the working folder.",
          picks: [{ key: "archive", label: "Choose a zip", kind: "file" }],
          build: (_values, picks) => unpackArchive(folder, picks.archive?.[0]?.path, [".zip"], (dest, archive) => ["-n", "-d", dest, archive]),
        },
      ]
    case "tar":
      return [
        {
          id: "pack",
          label: "Pack",
          hint: "Packs items from one folder into a new .tar.gz in the working folder.",
          fields: [{ key: "tar", label: "Archive name", placeholder: "Photos" }],
          picks: [{ key: "sources", label: "Choose files or folders", kind: "either", multiple: true }],
          build: (values, picks) => packSources(folder, values.tar ?? "", ".tar.gz", picks.sources ?? [], (dest, root, names) => ["-czf", dest, "-C", root, ...names]),
        },
        {
          id: "open",
          label: "Unpack",
          hint: "Unpacks a tar archive into a new folder in the working folder.",
          picks: [{ key: "archive", label: "Choose a tar archive", kind: "file" }],
          build: (_values, picks) => unpackArchive(folder, picks.archive?.[0]?.path, [".tar.gz", ".tgz", ".tar"], (dest, archive) => ["-xf", archive, "-C", dest]),
        },
      ]
    case "gzip":
      return [fileRead("gzip", "Compress", "Keeps the original and writes a .gz file beside it.", (file) => ["-k", "-n", file])]
    case "gunzip":
      return [fileRead("gunzip", "Restore", "Keeps the .gz file and restores the original beside it.", (file) => ["-k", file])]
    case "bzip2":
      return [
        fileRead("compress", "Compress", "Keeps the original and writes a .bz2 file beside it.", (file) => ["-k", file]),
        fileRead("restore", "Restore", "Keeps the .bz2 file and restores the original beside it.", (file) => ["-d", "-k", file]),
      ]
    case "df":
      return [{ id: "show", label: "Show disks", args: ["-h"] }]
    case "uname":
      return [{ id: "show", label: "Show system", args: ["-a"] }]
    case "sw_vers":
    case "whoami":
    case "id":
    case "date":
    case "uptime":
    case "hostname":
      return [{ id: "show", label: "Show", args: [] }]
    case "softwareupdate":
      return [{ id: "list", label: "Check for updates", args: ["-l"] }]
    case "ps":
      return [{ id: "show", label: "Show processes", args: ["-axo", "pid,pcpu,comm"] }]
    case "top":
      return [{ id: "snap", label: "Take a snapshot", args: ["-l", "1", "-n", "8", "-stats", "pid,cpu,mem,command"] }]
    case "git":
      return [
        { id: "status", label: "Status of Home", args: ["status"] },
        { id: "version", label: "Git version", args: ["--version"] },
      ]
    case "docker":
      return [
        { id: "version", label: "Docker version", args: ["--version"] },
        { id: "ps", label: "List containers", args: ["ps"] },
      ]
    case "echo":
      return [fieldAction("echo", "Print", "Text", "Hello", (text) => (text ? [text] : null))]
    case "say":
      return [fieldAction("say", "Speak", "Phrase", "Hello", (text) => (text ? [text] : null))]
    case "netstat":
    case "arp":
    case "route":
    case "printenv":
    case "alias":
    case "history":
    case "export":
    case "popd":
    case "pushd":
      return [{ id: "show", label: "Show", args: [] }]
    default:
      return null
  }
}

function transferAction(id: string, label: string): Action {
  return {
    id,
    label,
    picks: [
      { key: "sources", label: "Choose files", kind: "either", multiple: true },
      { key: "dest", label: "Choose destination folder", kind: "folder" },
    ],
    build: (_values, picks) => {
      const sources = picks.sources ?? []
      const dest = picks.dest?.[0]
      if (sources.length === 0 || !dest) return null
      return [...sources.map((item) => item.path), dest.path]
    },
  }
}

function fileRead(id: string, label: string, hint: string, toArgs: (file: string) => string[]): Action {
  return {
    id,
    label,
    hint,
    picks: [{ key: "file", label: "Choose file", kind: "file" }],
    build: (_values, picks) => (picks.file?.[0] ? toArgs(picks.file[0].path) : null),
  }
}

function packSources(
  folder: string,
  rawName: string,
  suffix: string,
  items: Picked[],
  toArgs: (dest: string, root: string, names: string[]) => string[],
): string[] | null {
  const paths = items.map((item) => item.path)
  const root = paths[0] ? parentPath(paths[0]) : ""
  const names = paths.map((item) => baseName(item))
  const dest = archiveFile(folder, rawName, suffix)
  if (!dest || !root || names.length === 0 || names.some((name) => !plainPiece(name))) return null
  if (!paths.every((item) => parentPath(item) === root)) return null
  return toArgs(dest, root, names)
}

function unpackArchive(
  folder: string,
  archive: string | undefined,
  suffixes: string[],
  toArgs: (dest: string, archive: string) => string[],
): string[] | null {
  if (!archive) return null
  const base = fileName(archive)
  const lower = base.toLowerCase()
  const suffix = suffixes.find((item) => lower.endsWith(item))
  if (!suffix) return null
  const name = base.slice(0, -suffix.length)
  const dest = joinChild(folder, name)
  if (!dest) return null
  return toArgs(dest, archive)
}

function archiveFile(folder: string, rawName: string, suffix: string): string | null {
  const trimmed = rawName.trim()
  if (!trimmed) return null
  const file = trimmed.toLowerCase().endsWith(suffix) ? trimmed : `${trimmed}${suffix}`
  return joinChild(folder, file)
}

function plainPiece(value: string): boolean {
  return Boolean(value) && value !== "." && value !== ".." && !value.startsWith("-") && !value.includes("/") && !value.includes("\\") && !value.includes("\0")
}

function confirmHint(mac: string, other: string): string {
  return window.consoless?.platform === "darwin" ? mac : other
}

function removeArgs(items: Picked[]): string[] | null {
  if (items.length === 0) return null
  const paths = items.map((item) => item.path)
  return items.some((item) => item.directory) ? ["-r", ...paths] : paths
}

function fieldAction(
  id: string,
  label: string,
  field: string,
  placeholder: string,
  build: (value: string) => string[] | null,
): Action {
  return {
    id,
    label,
    fields: [{ key: id, label: field, placeholder }],
    build: (values) => build((values[id] ?? "").trim()),
  }
}

function isHost(value: string): boolean {
  return /^[A-Za-z0-9.:_-]+$/.test(value)
}

export function fileName(filePath: string): string {
  return baseName(filePath) || filePath
}
