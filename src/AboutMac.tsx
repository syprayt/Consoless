import { useEffect, useState } from "react"
import { forgetRouter, loadComputer, loadRouterComputer, loadRouterDevices, powerRouter } from "./api"
import type { SystemChoice } from "../shared/device"
import type { ComputerFact, ComputerReport } from "../shared/types"

export function AboutMac({ choice, routerId, routerChoice, onForget }: { choice: SystemChoice; routerId: string | null; routerChoice: string; onForget?: () => void }) {
  const [report, setReport] = useState<ComputerReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [powerNote, setPowerNote] = useState<string | null>(null)
  const [connected, setConnected] = useState<ComputerFact[] | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let gone = false
    setReport(null)
    setError(null)
    setPowerNote(null)
    setConnected(null)
    const load = routerId ? loadRouterComputer(routerId) : loadComputer(choice)
    void load
      .then((next) => {
        if (!gone) setReport(next)
      })
      .catch((caught: unknown) => {
        if (!gone) setError(caught instanceof Error ? caught.message : "This device could not be read.")
      })
    return () => {
      gone = true
    }
  }, [attempt, choice, routerId, routerChoice])

  if (error) {
    return (
      <div className="mac-report">
        <p className="banner">{error}</p>
        {routerId && onForget && (
          <button type="button" className="text-button" onClick={() => void forget()}>
            Forget this router
          </button>
        )}
      </div>
    )
  }
  if (!report) return <p className="banner">Reading this device from the console…</p>

  return (
    <div className="mac-report">
      {report.notice ? (
        <p className="banner">{report.notice}</p>
      ) : (
        <p className="hint">{routerId ? "Read from the router over SSH. Nothing here is sent anywhere else." : "Read from the console on this device. Nothing here is sent anywhere."}</p>
      )}
      {report.sections.length === 0 && !report.notice && <p className="banner">Nothing could be read from the console.</p>}
      {report.sections.map((part) => (
        <section key={part.title} className="mac-section">
          <h2>{part.title}</h2>
          <div className="facts">
            {part.facts.map((item) => (
              <div key={item.label} className={item.warn ? "fact warn" : "fact"}>
                <span>{item.label}</span>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
        </section>
      ))}
      {report.commands.length > 0 && (
        <details className="mac-raw">
          <summary>Console output</summary>
          {report.commands.map((item) => (
            <div key={item.command}>
              <p className="cmdline">
                <code>{item.command}</code>
              </p>
              <pre>{item.output}</pre>
            </div>
          ))}
        </details>
      )}
      {connected && (
        <section className="mac-section">
          <h2>Connected</h2>
          {connected.length === 0 ? (
            <p className="hint">No other devices answered.</p>
          ) : (
            <div className="facts">
              {connected.map((item) => (
                <div key={`${item.label}:${item.value}`} className="fact">
                  <span>{item.label}</span>
                  <b>{item.value}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {routerId && (
        <div className="router-actions">
          <button type="button" className="primary" disabled={pending} onClick={() => void devices()}>
            Who is connected
          </button>
          {report.router?.canRestart && (
            <button type="button" className="primary" disabled={pending} onClick={() => void power("restart")}>
              Restart router
            </button>
          )}
          {report.router?.canReset && (
            <button type="button" className="primary danger" disabled={pending} onClick={() => void power("reset")}>
              Reset settings
            </button>
          )}
        </div>
      )}
      {powerNote && <p className="note">{powerNote}</p>}
      <div className="router-actions">
        <button type="button" className="text-button" onClick={() => setAttempt((value) => value + 1)}>
          Read again
        </button>
        {routerId && onForget && (
          <button type="button" className="text-button" onClick={() => void forget()}>
            Forget this router
          </button>
        )}
      </div>
    </div>
  )

  async function devices() {
    if (!routerId) return
    setPending(true)
    setPowerNote(null)
    try {
      const result = await loadRouterDevices(routerId)
      if ("error" in result) {
        setConnected(null)
        setPowerNote(result.error)
      } else setConnected(result.facts)
    } catch (caught) {
      setConnected(null)
      setPowerNote(caught instanceof Error ? caught.message : "The router did not respond.")
    } finally {
      setPending(false)
    }
  }

  async function power(action: "restart" | "reset") {
    if (!routerId) return
    setPending(true)
    setPowerNote(null)
    try {
      const result = await powerRouter(routerId, action)
      setPowerNote(result.error || result.stdout || "The router is restarting.")
    } catch (caught) {
      setPowerNote(caught instanceof Error ? caught.message : "The router did not respond.")
    } finally {
      setPending(false)
    }
  }

  async function forget() {
    if (!routerId) return
    await forgetRouter(routerId)
    onForget?.()
  }
}
