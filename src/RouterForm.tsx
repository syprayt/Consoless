import { useEffect, useState, type FormEvent } from "react"
import { loadGateway, saveRouter } from "./api"
import { computerPhrase, detectSystem } from "../shared/device"
import type { RouterRecord } from "../shared/router"

export function RouterForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (router: RouterRecord) => void }) {
  const [name, setName] = useState("")
  const [host, setHost] = useState("")
  const [user, setUser] = useState("root")
  const [port, setPort] = useState("22")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let gone = false
    void loadGateway().then((gateway) => {
      if (!gone && gateway) setHost((current) => current || gateway)
    })
    return () => {
      gone = true
    }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const result = await saveRouter({ name, host, user, port: Number(port) })
      if ("error" in result) setError(result.error)
      else onSaved(result.router)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The router could not be reached.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="mac-section router-form" onSubmit={(event) => void submit(event)}>
      <h2>Add a device</h2>
      <p className="hint">Consoless connects with the SSH key already on {computerPhrase(detectSystem(window.consoless?.platform ?? "darwin"))}. The password is not saved.</p>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Kitchen router" />
      </label>
      <label>
        Address
        <input value={host} onChange={(event) => setHost(event.target.value)} placeholder="192.168.0.1" autoFocus />
      </label>
      <label>
        User
        <input value={user} onChange={(event) => setUser(event.target.value)} placeholder="root" />
      </label>
      <label>
        Port
        <input value={port} onChange={(event) => setPort(event.target.value)} inputMode="numeric" />
      </label>
      {error && <p className="banner">{error}</p>}
      <div className="router-actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Connecting…" : "Connect"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
