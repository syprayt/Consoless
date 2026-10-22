import type { ReactNode } from "react"
import type { CategoryId } from "../shared/taxonomy"
import { PALETTE } from "../shared/taxonomy"

const ALIAS: Record<string, string> = {
  python3: "python",
  pip3: "pip",
  npx: "npm",
  nvim: "vim",
  gunzip: "gzip",
  bzip2: "gzip",
  sftp: "scp",
  host: "dig",
  nslookup: "dig",
  killall: "kill",
  rmdir: "rm",
  chown: "chmod",
  id: "whoami",
  popd: "pushd",
  pbpaste: "pbcopy",
  gcc: "clang",
  reboot: "shutdown",
  cursor: "code",
  gh: "git",
  ipconfig: "ifconfig",
  wget: "curl",
  more: "less",
}

export function Logo({
  name,
  category,
  known,
  runnable = false,
}: {
  name: string
  category: CategoryId
  known: boolean
  runnable?: boolean
}) {
  const tone = PALETTE[category]
  return (
    <svg className="logo" viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill={tone.bg} />
      <rect x="1.2" y="1.2" width="45.6" height="45.6" rx="13" fill="none" stroke="#fff" strokeOpacity="0.75" />
      {known ? <Glyph name={ALIAS[name] ?? name} category={category} color={tone.fg} /> : <Letter name={name} color={tone.fg} />}
      {runnable && <RunMark />}
    </svg>
  )
}

function RunMark() {
  return (
    <g>
      <circle cx="37.5" cy="37.5" r="8.4" fill="#fff" />
      <circle cx="37.5" cy="37.5" r="6.6" fill="#0071e3" />
      <path d="M35.4 33.7v7.6l6.4-3.8z" fill="#fff" />
    </g>
  )
}

function Letter({ name, color }: { name: string; color: string }) {
  const match = name.match(/[A-Za-z0-9]/)
  const ch = (match?.[0] ?? name[0] ?? "?").toUpperCase()
  return (
    <text
      x="24"
      y="25.5"
      textAnchor="middle"
      dominantBaseline="central"
      fill={color}
      fontSize="20"
      fontWeight="700"
      fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
    >
      {ch}
    </text>
  )
}

function Stroke({ color, children }: { color: string; children: ReactNode }) {
  return (
    <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </g>
  )
}

function Glyph({ name, category, color }: { name: string; category: CategoryId; color: string }) {
  const drawn = draw(name, color)
  if (drawn) return drawn
  return <CategoryGlyph category={category} color={color} />
}

function draw(name: string, color: string): ReactNode {
  switch (name) {
    case "ifconfig":
      return (
        <Stroke color={color}>
          <rect x="15" y="18" width="18" height="14" rx="3" />
          <path d="M20 18v-4h8v4M20 25h.1M28 25h.1" />
        </Stroke>
      )
    case "ping":
      return (
        <Stroke color={color}>
          <path d="M16 30a8 8 0 0 1 16 0M11 30a13 13 0 0 1 26 0" />
          <circle cx="24" cy="30" r="2.2" fill={color} stroke="none" />
        </Stroke>
      )
    case "curl":
      return (
        <Stroke color={color}>
          <path d="M16 24a8 8 0 1 0 2.4-5.7" />
          <path d="M16 14v6h6" />
        </Stroke>
      )
    case "ssh":
    case "sudo":
      return (
        <Stroke color={color}>
          <circle cx="24" cy="20" r="4" />
          <path d="M18 22.5V28a8 6 0 0 0 12 0v-5.5" />
          <path d="M24 26v4" />
        </Stroke>
      )
    case "scp":
      return (
        <Stroke color={color}>
          <path d="M14 20h8l2 2h8v10H14z" />
          <path d="M18 16h6l2 2" />
        </Stroke>
      )
    case "dig":
      return (
        <Stroke color={color}>
          <circle cx="22" cy="22" r="6" />
          <path d="M26.5 26.5 33 33" />
        </Stroke>
      )
    case "traceroute":
      return (
        <Stroke color={color}>
          <circle cx="14" cy="32" r="2" fill={color} stroke="none" />
          <circle cx="24" cy="22" r="2" fill={color} stroke="none" />
          <circle cx="34" cy="14" r="2" fill={color} stroke="none" />
          <path d="M16 30l6-6 8-6" />
        </Stroke>
      )
    case "nc":
      return (
        <Stroke color={color}>
          <path d="M18 16h8v6h6v10H18z" />
          <path d="M22 22h6" />
        </Stroke>
      )
    case "netstat":
      return (
        <Stroke color={color}>
          <path d="M16 32V22M24 32V16M32 32V24" />
          <path d="M14 32h20" />
        </Stroke>
      )
    case "arp":
      return (
        <Stroke color={color}>
          <circle cx="17" cy="20" r="3" />
          <circle cx="31" cy="20" r="3" />
          <path d="M20 20h8M17 24v6M31 24v6M14 30h6M28 30h6" />
        </Stroke>
      )
    case "route":
      return (
        <Stroke color={color}>
          <path d="M24 14v18" />
          <path d="M24 18h8l-2 3 2 3h-8" />
          <circle cx="24" cy="34" r="2" fill={color} stroke="none" />
        </Stroke>
      )
    case "networksetup":
      return (
        <Stroke color={color}>
          <path d="M16 18h16M16 24h16M16 30h16" />
          <circle cx="20" cy="18" r="2" fill={color} stroke="none" />
          <circle cx="28" cy="24" r="2" fill={color} stroke="none" />
          <circle cx="22" cy="30" r="2" fill={color} stroke="none" />
        </Stroke>
      )
    case "ls":
      return (
        <Stroke color={color}>
          <path d="M16 18h16M16 24h16M16 30h10" />
        </Stroke>
      )
    case "mkdir":
      return (
        <Stroke color={color}>
          <path d="M14 20h8l2 2h10v12H14z" />
          <path d="M24 26v6M21 29h6" />
        </Stroke>
      )
    case "rm":
      return (
        <Stroke color={color}>
          <path d="M18 20h12l-1 14H19z" />
          <path d="M16 20h16M22 18h4M22 24v6M26 24v6" />
        </Stroke>
      )
    case "cp":
      return (
        <Stroke color={color}>
          <rect x="16" y="18" width="12" height="14" rx="2" />
          <path d="M20 16h12v14" />
        </Stroke>
      )
    case "mv":
      return (
        <Stroke color={color}>
          <path d="M15 18h10v12H15z" />
          <path d="M27 24h8M31 20l4 4-4 4" />
        </Stroke>
      )
    case "touch":
      return (
        <Stroke color={color}>
          <path d="M18 16h8l6 6v12H18z" />
          <path d="M26 16v6h6M22 28h6" />
        </Stroke>
      )
    case "open":
      return (
        <Stroke color={color}>
          <path d="M16 20h8v12H16z" />
          <path d="M28 16h6v6M34 16l-8 8" />
        </Stroke>
      )
    case "find":
      return (
        <Stroke color={color}>
          <path d="M14 20h8l2 2h8v10H14z" />
          <circle cx="30" cy="30" r="3" />
          <path d="M32 32l3 3" />
        </Stroke>
      )
    case "mdfind":
      return (
        <Stroke color={color}>
          <circle cx="22" cy="22" r="6" />
          <path d="M26.5 26.5 32 32" />
          <path d="M22 14v2M30 18l-1.2 1.2" />
        </Stroke>
      )
    case "du":
      return (
        <Stroke color={color}>
          <path d="M16 32h4V22h-4zM22 32h4V18h-4zM28 32h4V24h-4z" />
        </Stroke>
      )
    case "df":
    case "diskutil":
      return (
        <Stroke color={color}>
          <ellipse cx="24" cy="18" rx="8" ry="3" />
          <path d="M16 18v10c0 1.7 3.6 3 8 3s8-1.3 8-3V18" />
        </Stroke>
      )
    case "chmod":
      return (
        <Stroke color={color}>
          <rect x="17" y="22" width="14" height="10" rx="2" />
          <path d="M20 22v-3a4 4 0 0 1 8 0v3" />
        </Stroke>
      )
    case "ln":
      return (
        <Stroke color={color}>
          <path d="M20 28l-3 3a4 4 0 0 1-6-6l3-3M28 20l3-3a4 4 0 0 1 6 6l-3 3M19 29l10-10" />
        </Stroke>
      )
    case "pwd":
      return (
        <Stroke color={color}>
          <path d="M14 20h8l2 2h10v12H14z" />
          <circle cx="24" cy="28" r="2" fill={color} stroke="none" />
        </Stroke>
      )
    case "cd":
      return (
        <Stroke color={color}>
          <path d="M14 20h8l2 2h10v12H14z" />
          <path d="M22 28h8M27 25l3 3-3 3" />
        </Stroke>
      )
    case "stat":
    case "file":
      return (
        <Stroke color={color}>
          <path d="M18 14h8l6 6v14H18z" />
          <path d="M26 14v6h6M21 28h6M21 24h4" />
        </Stroke>
      )
    case "cat":
      return (
        <Stroke color={color}>
          <path d="M16 22l4-6 4 4 4-4 4 6v8H16z" />
          <path d="M21 27h.1M27 27h.1" />
        </Stroke>
      )
    case "grep":
      return (
        <Stroke color={color}>
          <path d="M16 16h16l-6 8v8l-4-2v-6z" />
        </Stroke>
      )
    case "less":
    case "man":
      return (
        <Stroke color={color}>
          <path d="M16 16h10a6 6 0 0 1 0 12H16z" />
          <path d="M18 16v16" />
        </Stroke>
      )
    case "head":
      return (
        <Stroke color={color}>
          <path d="M18 16h12v16H18z" />
          <path d="M21 24l3-3 3 3M24 21v7" />
        </Stroke>
      )
    case "tail":
      return (
        <Stroke color={color}>
          <path d="M18 16h12v16H18z" />
          <path d="M21 24l3 3 3-3M24 20v7" />
        </Stroke>
      )
    case "sort":
      return (
        <Stroke color={color}>
          <path d="M18 18h8M18 24h12M18 30h6" />
          <path d="M32 16v14M29 27l3 3 3-3" />
        </Stroke>
      )
    case "diff":
      return (
        <Stroke color={color}>
          <path d="M16 16h7v16h-7zM25 16h7v16h-7z" />
        </Stroke>
      )
    case "wc":
      return (
        <Stroke color={color}>
          <path d="M16 30l4-12h2l4 12M18 26h6M28 18v12M28 24h6" />
        </Stroke>
      )
    case "sed":
      return (
        <Stroke color={color}>
          <path d="M16 20h16M16 26h10" />
          <path d="M30 28l4-8 2 2" />
        </Stroke>
      )
    case "awk":
      return (
        <Stroke color={color}>
          <path d="M18 18l6 12M30 18l-6 12M20 26h8" />
        </Stroke>
      )
    case "cut":
      return (
        <Stroke color={color}>
          <circle cx="18" cy="30" r="3" />
          <circle cx="26" cy="30" r="3" />
          <path d="M20 28 32 16M24 28 16 18" />
        </Stroke>
      )
    case "tr":
      return (
        <Stroke color={color}>
          <path d="M16 20h10M22 17l4 3-4 3M32 28H22M26 25l-4 3 4 3" />
        </Stroke>
      )
    case "uniq":
      return (
        <Stroke color={color}>
          <path d="M16 20h16M16 26h16M16 32h10" />
        </Stroke>
      )
    case "ps":
      return (
        <Stroke color={color}>
          <circle cx="18" cy="20" r="2" fill={color} stroke="none" />
          <circle cx="18" cy="26" r="2" fill={color} stroke="none" />
          <circle cx="18" cy="32" r="2" fill={color} stroke="none" />
          <path d="M23 20h9M23 26h9M23 32h6" />
        </Stroke>
      )
    case "top":
      return (
        <Stroke color={color}>
          <path d="M24 14a10 10 0 1 1-7 3" />
          <path d="M24 24l5-3" />
        </Stroke>
      )
    case "kill":
      return (
        <Stroke color={color}>
          <circle cx="24" cy="24" r="9" />
          <path d="M18 24h12" />
        </Stroke>
      )
    case "uname":
    case "sw_vers":
      return (
        <Stroke color={color}>
          <rect x="15" y="16" width="18" height="12" rx="2" />
          <path d="M20 32h8" />
        </Stroke>
      )
    case "whoami":
      return (
        <Stroke color={color}>
          <circle cx="24" cy="18" r="4" />
          <path d="M15 33c1.5-5 4-7 9-7s7.5 2 9 7" />
        </Stroke>
      )
    case "date":
      return (
        <Stroke color={color}>
          <rect x="15" y="16" width="18" height="16" rx="2" />
          <path d="M15 22h18M20 14v4M28 14v4" />
        </Stroke>
      )
    case "uptime":
      return (
        <Stroke color={color}>
          <circle cx="24" cy="25" r="8" />
          <path d="M24 21v4l3 2" />
        </Stroke>
      )
    case "hostname":
      return (
        <Stroke color={color}>
          <rect x="14" y="18" width="20" height="12" rx="2" />
          <path d="M18 30v3h12v-3M22 22h4" />
        </Stroke>
      )
    case "softwareupdate":
      return (
        <Stroke color={color}>
          <path d="M30 18a8 8 0 1 0 2 6" />
          <path d="M30 14v6h-6" />
        </Stroke>
      )
    case "shutdown":
      return (
        <Stroke color={color}>
          <path d="M24 14v8" />
          <path d="M18 20a8 8 0 1 0 12 0" />
        </Stroke>
      )
    case "pmset":
      return (
        <Stroke color={color}>
          <rect x="16" y="16" width="14" height="16" rx="2" />
          <path d="M30 20h2v6h-2" />
        </Stroke>
      )
    case "git":
      return (
        <Stroke color={color}>
          <circle cx="18" cy="16" r="2.2" fill={color} stroke="none" />
          <circle cx="18" cy="32" r="2.2" fill={color} stroke="none" />
          <circle cx="30" cy="24" r="2.2" fill={color} stroke="none" />
          <path d="M18 18v12M18 24h10" />
        </Stroke>
      )
    case "node":
      return (
        <Stroke color={color}>
          <path d="M24 14l8 4.5v9L24 32l-8-4.5v-9z" />
        </Stroke>
      )
    case "npm":
    case "pip":
      return (
        <Stroke color={color}>
          <path d="M16 18h16v12H16z" />
          <path d="M20 18v6h4v-6M28 22v8" />
        </Stroke>
      )
    case "python":
      return (
        <Stroke color={color}>
          <path d="M20 16c6 0 8 3 8 6s-3 4-6 4-4 1-4 3 2 3 6 3" />
          <path d="M22 20h.1M26 28h.1" />
        </Stroke>
      )
    case "docker":
      return (
        <Stroke color={color}>
          <path d="M14 26h4v-4h4v4h4v-4h4v4h4" />
          <path d="M14 26c0 4 4 6 10 6s10-2 12-5" />
        </Stroke>
      )
    case "vim":
      return (
        <Stroke color={color}>
          <path d="M16 16h16v16H16z" />
          <path d="M20 28l4-8 4 8M22 25h4" />
        </Stroke>
      )
    case "nano":
      return (
        <Stroke color={color}>
          <path d="M18 32l12-14 3 3L21 34z" />
          <path d="M28 18l3 3" />
        </Stroke>
      )
    case "code":
      return (
        <Stroke color={color}>
          <path d="M20 18l-6 6 6 6M28 18l6 6-6 6" />
        </Stroke>
      )
    case "make":
      return (
        <Stroke color={color}>
          <path d="M18 30l10-14 4 3-10 14z" />
          <path d="M16 32h8" />
        </Stroke>
      )
    case "clang":
      return (
        <Stroke color={color}>
          <path d="M18 18l8 14 4-14" />
          <path d="M16 32h16" />
        </Stroke>
      )
    case "go":
      return (
        <Stroke color={color}>
          <path d="M14 26l16-8-4 14-4-4z" />
        </Stroke>
      )
    case "cargo":
      return (
        <Stroke color={color}>
          <path d="M16 22h16v10H16zM16 22l3-4h10l3 4" />
        </Stroke>
      )
    case "ruby":
      return (
        <Stroke color={color}>
          <path d="M24 14l8 6-8 14-8-14z" />
        </Stroke>
      )
    case "perl":
      return (
        <Stroke color={color}>
          <path d="M18 30c0-8 12-8 12-2s-6 4-6 8" />
          <circle cx="24" cy="20" r="1.4" fill={color} stroke="none" />
        </Stroke>
      )
    case "adb":
      return (
        <Stroke color={color}>
          <rect x="18" y="14" width="12" height="20" rx="2" />
          <path d="M22 30h4" />
        </Stroke>
      )
    case "brew":
      return (
        <Stroke color={color}>
          <path d="M18 18h12v8a6 6 0 0 1-12 0z" />
          <path d="M30 20h3a3 3 0 0 1 0 6h-3" />
        </Stroke>
      )
    case "mas":
      return (
        <Stroke color={color}>
          <path d="M18 30l6-14 6 14M20.5 25h7" />
        </Stroke>
      )
    case "tar":
    case "zip":
      return (
        <Stroke color={color}>
          <path d="M16 18h16v14H16z" />
          <path d="M24 18v14M21 22h3M24 26h3M21 30h3" />
        </Stroke>
      )
    case "unzip":
      return (
        <Stroke color={color}>
          <path d="M16 22h16v10H16z" />
          <path d="M20 22v-4h8v4M24 14v4" />
        </Stroke>
      )
    case "gzip":
      return (
        <Stroke color={color}>
          <path d="M16 24h8l8-6v12l-8-6H16z" />
        </Stroke>
      )
    case "say":
      return (
        <Stroke color={color}>
          <path d="M16 20h10v8H16z" />
          <path d="M26 22c2 1 2 5 0 6M29 20c3 2 3 8 0 10" />
        </Stroke>
      )
    case "afplay":
      return (
        <Stroke color={color}>
          <path d="M20 18v12l10-6z" />
        </Stroke>
      )
    case "screencapture":
    case "sips":
      return (
        <Stroke color={color}>
          <rect x="15" y="18" width="18" height="13" rx="2" />
          <circle cx="24" cy="24" r="3" />
          <path d="M20 18l1-3h6l1 3" />
        </Stroke>
      )
    case "echo":
      return (
        <Stroke color={color}>
          <path d="M16 22c4 0 4 8 0 8M22 20c5 1 5 11 0 12M28 18c6 2 6 14 0 16" />
        </Stroke>
      )
    case "alias":
      return (
        <Stroke color={color}>
          <path d="M16 20h10l2 2v8H16zM24 22h8v10" />
        </Stroke>
      )
    case "history":
      return (
        <Stroke color={color}>
          <path d="M18 24a7 7 0 1 0 2-5" />
          <path d="M16 16v6h6M24 21v4l2 2" />
        </Stroke>
      )
    case "export":
    case "source":
      return (
        <Stroke color={color}>
          <path d="M16 18h12v12H16z" />
          <path d="M28 24h6M31 21l3 3-3 3" />
        </Stroke>
      )
    case "pushd":
      return (
        <Stroke color={color}>
          <path d="M16 28h16M16 23h16M16 18h16" />
        </Stroke>
      )
    case "which":
      return (
        <Stroke color={color}>
          <circle cx="24" cy="20" r="6" />
          <path d="M24 26v6M21 32h6" />
        </Stroke>
      )
    case "printenv":
      return (
        <Stroke color={color}>
          <path d="M16 16h16v16H16z" />
          <path d="M20 22h8M20 26h5" />
        </Stroke>
      )
    case "pbcopy":
      return (
        <Stroke color={color}>
          <rect x="17" y="16" width="14" height="16" rx="2" />
          <path d="M21 16v-2h6v2" />
        </Stroke>
      )
    default:
      return null
  }
}

function CategoryGlyph({ category, color }: { category: CategoryId; color: string }) {
  switch (category) {
    case "network":
      return draw("arp", color)
    case "files":
      return draw("pwd", color)
    case "text":
      return draw("ls", color)
    case "system":
      return draw("uname", color)
    case "dev":
      return draw("code", color)
    case "packages":
      return draw("cargo", color)
    case "archive":
      return draw("tar", color)
    case "media":
      return draw("afplay", color)
    case "shell":
      return draw("echo", color)
    default:
      return (
        <Stroke color={color}>
          <circle cx="24" cy="24" r="7" />
        </Stroke>
      )
  }
}
