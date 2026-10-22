export function summarizeDu(stdout: string): string | null {
  const size = stdout.trim().split(/\s+/)[0]
  return size ? size : null
}

export function summarizeWc(stdout: string): string | null {
  const parts = stdout.trim().split(/\s+/)
  if (parts.length < 3 || !parts.slice(0, 3).every((part) => /^\d+$/.test(part))) return null
  const [lines, words, bytes] = parts
  return `${lines} lines, ${words} words, ${bytes} bytes`
}

export function quoteArg(value: string): string {
  if (value === "") return "''"
  if (/^[~A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value
  return `'${value.replaceAll("'", "'\\''")}'`
}

export type Iface = {
  name: string
  flags: string[]
  inet: string[]
  inet6: string[]
  ether: string | null
}

export function parseIfconfig(text: string): Iface[] {
  return text
    .trim()
    .split(/\n(?=\S)/)
    .map((chunk) => {
      const lines = chunk.split("\n")
      const head = lines[0] ?? ""
      const name = head.split(":")[0]?.trim() || "interface"
      const flags = head.match(/<([^>]+)>/)?.[1]?.split(",") ?? []
      const inet: string[] = []
      const inet6: string[] = []
      let ether: string | null = null
      for (const line of lines.slice(1)) {
        const parts = line.trim().split(/\s+/)
        if (parts[0] === "inet" && parts[1]) inet.push(parts[1])
        else if (parts[0] === "inet6" && parts[1]) inet6.push(parts[1])
        else if (parts[0] === "ether" && parts[1]) ether = parts[1]
      }
      return { name, flags, inet, inet6, ether }
    })
    .filter((item) => item.name)
}
