import { useEffect, useMemo, useRef, useState } from "react"
import { canRun } from "./actions"
import { chooseRouter, loadCatalog, loadRouterCatalog, loadRouters } from "./api"
import { AboutMac } from "./AboutMac"
import { Card } from "./Card"
import { Logo } from "./icons"
import { RouterForm } from "./RouterForm"
import { commandsTitle, detectSystem, lookupLabel, parseChoice, systemLabel, type SystemChoice } from "../shared/device"
import { parseRouterChoice, routerLabel, type RouterChoice, type RouterRecord } from "../shared/router"
import { CATEGORIES, CATEGORY_LABEL, type CategoryId } from "../shared/taxonomy"
import type { Catalog, CommandInfo } from "../shared/types"

type Scope = "known" | "all"
type SortMode = "rooms" | "az" | "za" | "known"

export function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState<Scope>("known")
  const [sort, setSort] = useState<SortMode>("rooms")
  const [category, setCategory] = useState<CategoryId | "all">("all")
  const [limit, setLimit] = useState(300)
  const [selected, setSelected] = useState<string | null>(null)
  const [about, setAbout] = useState(false)
  const [choice, setChoice] = useState<SystemChoice>(storedChoice)
  const [routers, setRouters] = useState<RouterRecord[]>([])
  const [routerId, setRouterId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [folder, setFolder] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadRouters().then(setRouters).catch(() => setRouters([]))
  }, [])

  useEffect(() => {
    void load(false)
  }, [routerId])

  useEffect(() => {
    if (catalog && !catalog.firmware && folder === null) setFolder(catalog.home)
  }, [catalog, folder])

  useEffect(() => {
    setLimit(scope === "known" ? 300 : 48)
  }, [scope, query, sort, category])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null)
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  async function load(refresh: boolean) {
    setError(null)
    try {
      setCatalog(routerId ? await loadRouterCatalog(routerId) : await loadCatalog(refresh))
    } catch (caught) {
      setCatalog(null)
      setError(caught instanceof Error ? caught.message : "The commands on this device could not be read.")
    }
  }

  const commands = catalog?.commands ?? []
  const knownCount = commands.filter((command) => command.known).length
  const needle = query.trim().toLowerCase()

  const searched = useMemo(() => {
    const base = scope === "known" ? commands.filter((command) => command.known) : commands
    if (!needle) return base
    return base.filter((command) => haystack(command).includes(needle))
  }, [commands, scope, needle])

  const counts = useMemo(() => {
    const map = new Map<CategoryId, number>()
    for (const command of searched) map.set(command.category, (map.get(command.category) ?? 0) + 1)
    return map
  }, [searched])

  const filtered = category === "all" ? searched : searched.filter((command) => command.category === category)
  const sorted = useMemo(() => [...filtered].sort((a, b) => compare(a, b, sort)), [filtered, sort])
  const shown = sorted.slice(0, limit)
  const selectedCommand = commands.find((command) => command.name === selected) ?? null
  const hiddenKnown = scope === "known" && needle ? commands.some((command) => !command.known && haystack(command).includes(needle)) : false
  const workingFolder = folder ?? catalog?.home ?? ""
  const router = routers.find((item) => item.id === routerId) ?? null
  const host = detectSystem(window.consoless?.platform ?? "darwin")
  const macWindow = host === "macos"

  async function changeRouter(id: string, next: RouterChoice) {
    await chooseRouter(id, next)
    setRouters((items) => items.map((item) => (item.id === id ? { ...item, choice: next } : item)))
  }

  return (
    <div className={["shell", macWindow ? "mac" : "", selectedCommand ? "with-card" : ""].filter(Boolean).join(" ")}>
      {macWindow && <div className="drag" />}
      <header className="top">
        <div>
          <p className="brand">Consoless</p>
          <h1>{routerId ? "Commands on this router, as ordinary icons" : catalog ? commandsTitle(catalog.system) : commandsTitle(host)}</h1>
          {catalog && (
            <p className="lede">
              {catalog.hostname}: {commands.length} {commands.length === 1 ? "command" : "commands"}, {knownCount} with their own icons. The rest use a letter.
            </p>
          )}
        </div>
        <button type="button" className="text-button" onClick={() => void load(true)}>
          Refresh list
        </button>
      </header>

      <div className="toolbar">
        <label className="search">
          <span className="glass" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search: network, folder, git, ifconfig"
            aria-label="Search commands"
            autoFocus
          />
        </label>
        <label className="sort">
          Order
          <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Sort">
            <option value="rooms">By room</option>
            <option value="az">Name A → Z</option>
            <option value="za">Name Z → A</option>
            <option value="known">Popular first</option>
          </select>
        </label>
      </div>

      <div className="scopes-row">
        <div className="scopes" role="tablist" aria-label="Which commands to show">
          <button type="button" role="tab" aria-selected={!about && scope === "known"} className={!about && scope === "known" ? "on" : ""} onClick={() => { setAbout(false); setScope("known") }}>
            Popular
          </button>
          <button type="button" role="tab" aria-selected={!about && scope === "all"} className={!about && scope === "all" ? "on" : ""} onClick={() => { setAbout(false); setScope("all") }}>
            All {commands.length || ""}
          </button>
          <button type="button" role="tab" aria-selected={about} className={about ? "on" : ""} onClick={() => { setAbout(true); setSelected(null) }}>
            About this device
          </button>
        </div>
        <div className="device-choices">
          <label className="system-choice">
            Device
            <select
              value={routerId ?? "computer"}
              aria-label="Device"
              onChange={(event) => {
                const value = event.target.value
                setAbout(false)
                setSelected(null)
                if (value === "add") {
                  setAdding(true)
                  return
                }
                setAdding(false)
                setRouterId(value === "computer" ? null : value)
              }}
            >
              <option value="computer">This computer</option>
              {routers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
              <option value="add">Add a device…</option>
            </select>
          </label>
          {router ? (
            <label className="system-choice">
              System
              <select aria-label="System" value={router.choice} onChange={(event) => void changeRouter(router.id, parseRouterChoice(event.target.value))}>
                <option value="auto">Automatic · {routerLabel(catalog?.firmware ?? "linux")}</option>
                <option value="openwrt">OpenWrt</option>
                <option value="linux">Linux</option>
              </select>
            </label>
          ) : (
            <label className="system-choice">
              System
              <select
                value={choice}
                aria-label="System"
                onChange={(event) => {
                  const next = parseChoice(event.target.value)
                  setChoice(next)
                  storeChoice(next)
                }}
              >
                <option value="auto">Automatic · {systemLabel(catalog?.system ?? "macos")}</option>
                <option value="macos">macOS</option>
                <option value="linux">Linux</option>
                <option value="windows">Windows</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {adding ? (
        <RouterForm
          onCancel={() => setAdding(false)}
          onSaved={(saved) => {
            setRouters((items) => [...items, saved])
            setRouterId(saved.id)
            setAdding(false)
          }}
        />
      ) : about ? (
        <AboutMac
          choice={choice}
          routerId={routerId}
          routerChoice={router?.choice ?? "auto"}
          onForget={
            routerId
              ? () => {
                  setRouters((items) => items.filter((item) => item.id !== routerId))
                  setRouterId(null)
                  setAbout(false)
                }
              : undefined
          }
        />
      ) : (
      <>
      {routerId ? (
        <p className="hint">These commands are installed on the router. Who is connected, restart, and reset are on About this device. Restart and reset ask before they run.</p>
      ) : catalog && choice !== "auto" && choice !== catalog.system && (
        <p className="hint">Commands are the ones installed on this computer. The system choice is used when reading device details.</p>
      )}
      <div className="chips">
        <button type="button" className={category === "all" ? "chip on" : "chip"} onClick={() => setCategory("all")}>
          All rooms <b>{searched.length}</b>
        </button>
        {CATEGORIES.filter((item) => (counts.get(item.id) ?? 0) > 0).map((item) => (
          <button
            key={item.id}
            type="button"
            className={category === item.id ? "chip on" : "chip"}
            onClick={() => setCategory(item.id)}
          >
            {item.label} <b>{counts.get(item.id)}</b>
          </button>
        ))}
      </div>

      <p className="hint">
        {scope === "known"
          ? "Popular commands come first, each with an icon. Rare ones stay under All and turn up in search. "
          : `Showing ${Math.min(limit, sorted.length)} of ${sorted.length}. Search and rooms narrow the list. `}
        A play mark means the command has a button.
      </p>

      {error && <p className="banner">{error}</p>}
      {!catalog && !error && <p className="banner">{lookupLabel(host)}</p>}

      {catalog && sorted.length === 0 && (
        <div className="empty">
          <p>Nothing matched.</p>
          {hiddenKnown && (
            <button type="button" className="primary" onClick={() => setScope("all")}>
              Search all commands
            </button>
          )}
        </div>
      )}

      {sort === "rooms" ? (
        <div className="rooms">
          {group(shown).map((room) => (
            <section key={room.id}>
              <h2>{room.label}</h2>
              <div className="grid">
                {room.items.map((command) => (
                  <Tile
                    key={command.name}
                    command={command}
                    home={catalog?.home ?? ""}
                    folder={workingFolder}
                    remote={Boolean(routerId)}
                    selected={selected === command.name}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid flat">
          {shown.map((command) => (
            <Tile
              key={command.name}
              command={command}
              home={catalog?.home ?? ""}
              folder={workingFolder}
              remote={Boolean(routerId)}
              selected={selected === command.name}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      {sorted.length > shown.length && (
        <button type="button" className="more" onClick={() => setLimit((value) => value + (scope === "known" ? 100 : 48))}>
          Show {Math.min(scope === "known" ? 100 : 48, sorted.length - shown.length)} more
        </button>
      )}

      </>
      )}

      {selectedCommand && catalog && !about && (
        <Card
          command={selectedCommand}
          home={catalog.home}
          folder={workingFolder}
          remote={Boolean(routerId)}
          onClose={() => setSelected(null)}
          onWent={(path) => setFolder(path)}
        />
      )}
    </div>
  )
}

function Tile({
  command,
  home,
  folder,
  remote,
  selected,
  onSelect,
}: {
  command: CommandInfo
  home: string
  folder: string
  remote: boolean
  selected: boolean
  onSelect: (name: string) => void
}) {
  const runnable = !remote && canRun(command.name, command.blocked, command.interactive, home, folder)
  return (
    <button type="button" className={selected ? "tile selected" : "tile"} onClick={() => onSelect(command.name)} aria-pressed={selected}>
      <Logo name={command.name} category={command.category} known={command.known} runnable={runnable} />
      <span className="title">{command.title}</span>
      {command.title !== command.name && <span className="cmd">{command.name}</span>}
      {runnable && <span className="sr">Can run</span>}
    </button>
  )
}

function storedChoice(): SystemChoice {
  try {
    return parseChoice(localStorage.getItem("consoless.system"))
  } catch {
    return "auto"
  }
}

function storeChoice(choice: SystemChoice) {
  try {
    localStorage.setItem("consoless.system", choice)
  } catch {
    // The choice still applies until the window closes.
  }
}

function haystack(command: CommandInfo): string {
  return `${command.name} ${command.title} ${command.summary} ${CATEGORY_LABEL[command.category]}`.toLowerCase()
}

function compare(a: CommandInfo, b: CommandInfo, sort: SortMode): number {
  if (sort === "known" && a.known !== b.known) return a.known ? -1 : 1
  if (sort === "rooms") {
    const rooms = CATEGORIES.findIndex((item) => item.id === a.category) - CATEGORIES.findIndex((item) => item.id === b.category)
    if (rooms !== 0) return rooms
    if (a.known !== b.known) return a.known ? -1 : 1
  }
  const title = a.title.localeCompare(b.title, "en")
  return sort === "za" ? -title || b.name.localeCompare(a.name, "en") : title || a.name.localeCompare(b.name, "en")
}

function group(items: CommandInfo[]): Array<{ id: CategoryId; label: string; items: CommandInfo[] }> {
  const buckets = new Map<CategoryId, CommandInfo[]>()
  for (const item of items) {
    const list = buckets.get(item.category) ?? []
    list.push(item)
    buckets.set(item.category, list)
  }
  return CATEGORIES.filter((category) => buckets.has(category.id)).map((category) => ({
    id: category.id,
    label: category.label,
    items: buckets.get(category.id) ?? [],
  }))
}
