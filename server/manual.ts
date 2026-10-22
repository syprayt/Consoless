import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

const ROOTS = [
  "/opt/homebrew/share/man",
  "/usr/local/share/man",
  "/usr/share/man",
  "/Library/Developer/CommandLineTools/usr/share/man",
]

const cache = new Map<string, string | null>()

export function manualSummary(name: string): string | null {
  if (!/^[A-Za-z0-9._+-]+$/.test(name)) return null
  if (cache.has(name)) return cache.get(name) ?? null

  const sections = ["1", "8", "1m", "6"]
  for (const root of roots()) {
    for (const section of sections) {
      for (const ext of ["", ".gz"]) {
        const file = path.join(root, `man${section}`, `${name}.${section}${ext}`)
        if (!fs.existsSync(file)) continue
        try {
          const buf = fs.readFileSync(file)
          const text = ext === ".gz" ? zlib.gunzipSync(buf).toString("utf8") : buf.toString("utf8")
          const summary = parseName(text)
          if (summary) {
            cache.set(name, summary)
            return summary
          }
        } catch {
          continue
        }
      }
    }
  }

  cache.set(name, null)
  return null
}

function roots(): string[] {
  const separator = process.platform === "win32" ? ";" : ":"
  const fromEnv = process.env.MANPATH?.split(separator).filter(Boolean) ?? []
  return [...new Set([...fromEnv, ...ROOTS])]
}

function parseName(text: string): string | null {
  const nd = text.match(/^\.Nd\s+(.+)$/m)
  if (nd) return clean(nd[1])

  const block = text.match(/^\.S[hH] NAME\n([\s\S]{0,500}?)(?=^\.S[hH] )/m)
  if (!block) return null
  for (const raw of block[1].split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith(".\\\"") || line.startsWith(".Nm")) continue
    const parts = line.split(/\\?-/)
    if (parts.length < 2) continue
    const summary = clean(parts.slice(1).join("-"))
    if (summary) return summary
  }
  return null
}

function clean(value: string): string {
  return value
    .replace(/\\&/g, "")
    .replace(/\\-/g, "-")
    .replace(/\\f\w/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
