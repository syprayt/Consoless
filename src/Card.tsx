import { useEffect, useState } from "react"
import { actionsFor, canRun, fileName, resolveArgs, type Action, type Picked } from "./actions"
import { loadDetail, pickItems, runCommand } from "./api"
import { parseIfconfig, quoteArg, summarizeDu, summarizeWc, type Iface } from "./format"
import { isLocalPath } from "./folder"
import { Logo } from "./icons"
import { windowsPreview } from "../shared/windows-files"
import { CATEGORY_LABEL } from "../shared/taxonomy"
import type { CommandInfo, RunResult } from "../shared/types"

export function Card({
  command,
  home,
  folder,
  onClose,
  onWent,
  remote = false,
}: {
  command: CommandInfo
  home: string
  folder: string
  onClose: () => void
  onWent: (path: string) => void
  remote?: boolean
}) {
  const [manual, setManual] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [picks, setPicks] = useState<Record<string, Picked[]>>({})
  const [pending, setPending] = useState<string | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)
  const actions = actionsFor(command.name, home, folder)

  useEffect(() => {
    setManual(null)
    setValues({})
    setPicks({})
    setResult(null)
    setPending(null)
    let cancel = false
    void loadDetail(command.name)
      .then((detail) => {
        if (!cancel) setManual(detail.manual)
      })
      .catch(() => {
        if (!cancel) setManual(null)
      })
    return () => {
      cancel = true
    }
  }, [command.name])

  async function choose(action: Action, key: string, kind: "file" | "folder" | "either", multiple?: boolean) {
    const chosen = await pickItems(kind, Boolean(multiple), folder)
    if (chosen.length === 0) return
    setPicks((current) => {
      const id = `${action.id}:${key}`
      const previous = multiple ? (current[id] ?? []) : []
      const merged = [...previous]
      for (const item of chosen) {
        if (!merged.some((entry) => entry.path === item.path)) merged.push(item)
      }
      return { ...current, [id]: merged }
    })
  }

  function picksFor(action: Action): Record<string, Picked[]> {
    const selected: Record<string, Picked[]> = {}
    for (const pick of action.picks ?? []) selected[pick.key] = picks[`${action.id}:${pick.key}`] ?? []
    return selected
  }

  async function run(action: Action) {
    const args = resolveArgs(action, values, picksFor(action))
    if (!args) return
    setPending(action.id)
    setResult(null)
    try {
      const body = await runCommand(command.name, args)
      setResult(body)
      if (body.ok && command.name === "cd") {
        const next = body.stdout.trim()
        if (isLocalPath(next)) onWent(next)
      }
      if (body.ok && command.name === "ls") {
        const next = body.argv[2]
        if (next && isLocalPath(next)) onWent(next)
      }
      if (body.ok && (command.name === "rm" || command.name === "rmdir" || command.name === "mv")) {
        setPicks((current) => {
          const next = { ...current }
          for (const pick of action.picks ?? []) delete next[`${action.id}:${pick.key}`]
          return next
        })
      }
    } catch (error) {
      setResult({
        ok: false,
        code: 1,
        stdout: "",
        stderr: "",
        timedOut: false,
        argv: [command.name],
        error: error instanceof Error ? error.message : "The app could not run that command.",
      })
    } finally {
      setPending(null)
    }
  }

  const place = remote ? "On the router" : command.kind === "builtin" ? "Built into the shell" : !command.path ? "Windows command" : command.path.replace(home, "~")

  return (
    <aside className="card" aria-label={command.title}>
      <div className="card-head">
        <Logo
          name={command.name}
          category={command.category}
          known={command.known}
          runnable={!remote && canRun(command.name, command.blocked, command.interactive, home, folder)}
        />
        <div>
          <p className="eyebrow">{CATEGORY_LABEL[command.category]}</p>
          <h2>{command.title}</h2>
          {command.title !== command.name && <p className="mono">{command.name}</p>}
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="Close">
          Close
        </button>
      </div>

      {command.summary && <p className="summary">{command.summary}</p>}
      {!remote && manual && <p className="manual">From the macOS manual: {manual}</p>}
      <p className="place">{place}</p>
      {remote && <p className="note">This command is on the router. Who is connected, restart, and reset are on About this device. Restart and reset ask before they run.</p>}
      {!remote && command.note && <p className="note">{command.note}</p>}
      {!remote && command.blocked && !command.note && <p className="note">There is no run button. This command changes the system.</p>}
      {!remote && command.interactive && <p className="note">This program waits for the keyboard, so the card stays closed to typing.</p>}
      {!remote && !command.blocked && !command.interactive && actions.length === 0 && (
        <p className="note">This card shows the command and its manual. A button will appear when the form is clear.</p>
      )}

      {!remote && <div className="actions">
        {actions.map((action) => {
          const selected = picksFor(action)
          const args = resolveArgs(action, values, selected)
          return (
            <form
              key={action.id}
              className="action"
              onSubmit={(event) => {
                event.preventDefault()
                void run(action)
              }}
            >
              {action.hint && <p className="hint">{action.hint}</p>}
              {action.picks?.map((pick) => {
                const items = selected[pick.key] ?? []
                return (
                  <div key={pick.key} className="picker">
                    <button type="button" className="ghost" onClick={() => void choose(action, pick.key, pick.kind, pick.multiple)}>
                      {pick.label}
                    </button>
                    {items.length > 0 && (
                      <ul className="picked">
                        {items.map((item) => (
                          <li key={item.path}>
                            <span>{fileName(item.path)}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${fileName(item.path)}`}
                              onClick={() =>
                                setPicks((current) => ({
                                  ...current,
                                  [`${action.id}:${pick.key}`]: (current[`${action.id}:${pick.key}`] ?? []).filter((entry) => entry.path !== item.path),
                                }))
                              }
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
              {action.fields?.map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input
                    value={values[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                </label>
              ))}
              <p className="cmdline">
                <span>Will run</span>
                <code>{(windowsPreview(window.consoless?.platform ?? "", command.name, args ?? []) ?? [command.name, ...(args ?? [])]).map(quoteArg).join(" ")}</code>
              </p>
              <button type="submit" className={action.tone === "danger" ? "primary danger" : "primary"} disabled={pending !== null || args === null}>
                {pending === action.id ? "Working…" : action.label}
              </button>
            </form>
          )
        })}
      </div>}

      {result && <Result command={command.name} result={result} />}
    </aside>
  )
}

function Result({ command, result }: { command: string; result: RunResult }) {
  const interfaces = command === "ifconfig" && result.stdout ? parseIfconfig(result.stdout) : []
  const real = interfaces.filter((item) => item.inet.some((address) => address !== "127.0.0.1"))
  const shown = real.length > 0 ? real : interfaces.filter((item) => item.inet.length > 0).slice(0, 4)
  const names = command === "ls" && result.stdout ? result.stdout.split("\n").map(listName).filter(Boolean) : []
  const summary = command === "du" ? summarizeDu(result.stdout) : command === "wc" ? summarizeWc(result.stdout) : null

  return (
    <section className="result" aria-live="polite">
      {result.error && <p className="note">{result.error}</p>}
      {result.timedOut && <p className="note">Stopped after a few seconds so the command would not hang.</p>}
      {result.ok && (command === "rm" || command === "rmdir") && <p className="done">Deleted.</p>}
      {result.ok && quietNote(command, result) && <p className="done">{quietNote(command, result)}</p>}
      {result.ok && command === "du" && summary && <p className="ip">{summary}</p>}
      {result.ok && command === "wc" && summary && <p className="done">{summary}</p>}
      {shown.length > 0 && (
        <div className="ifaces">
          {shown.map((item) => (
            <IfaceView key={item.name} item={item} />
          ))}
        </div>
      )}
      {names.length > 0 && (
        <ul className="names">
          {names.slice(0, 24).map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
      {!result.error && !result.stdout && !result.stderr && !quietNote(command, result) && command !== "rm" && command !== "rmdir" && command !== "mkdir" && command !== "mv" && command !== "cp" && (
        <p className="note">The command finished and printed nothing.</p>
      )}
      {(result.stdout || result.stderr) && (
        <details open={shown.length === 0 && names.length === 0}>
          <summary>{shown.length > 0 ? "Full text" : "Output"}</summary>
          {result.stdout && <pre>{result.stdout}</pre>}
          {result.stderr && <pre className="stderr">{result.stderr}</pre>}
        </details>
      )}
    </section>
  )
}

function quietNote(command: string, result: RunResult): string | null {
  if (!result.ok) return null
  if (command === "touch") return "Created."
  if (command === "zip" || (command === "tar" && result.argv.includes("-czf"))) return "Packed."
  if (command === "unzip" || (command === "tar" && result.argv.includes("-xf"))) return "Unpacked."
  if (command === "gzip" || (command === "bzip2" && !result.argv.includes("-d"))) return "Compressed."
  if (command === "gunzip" || (command === "bzip2" && result.argv.includes("-d"))) return "Restored."
  return null
}

function listName(line: string): string {
  const trimmed = line.trim()
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed
}

function IfaceView({ item }: { item: Iface }) {
  const live = item.flags.includes("UP") || item.flags.includes("RUNNING")
  return (
    <article className="iface">
      <header>
        <strong>{item.name}</strong>
        {live && <span>up</span>}
      </header>
      {item.inet.map((address) => (
        <p key={address} className="ip">
          {address}
        </p>
      ))}
      {item.ether && <p className="ether">{item.ether}</p>}
    </article>
  )
}
