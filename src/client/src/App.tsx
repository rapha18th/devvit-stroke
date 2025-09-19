// src/client/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  API_BASE,
  health,
  startToday,
  compareSignature,
  compareMetadata,
  submitGuess,
  getDailyLeaderboard,
} from "./api";

type CasePublic = {
  case_id: string;
  mode: "knowledge" | "observation";
  brief: string;
  images: string[];
  signature_crops: string[];
  metadata: any[];
  ledger_summary: string;
  timer_seconds: number;
  initial_ip: number;
  tool_costs: { signature: number; metadata: number };
  credits: any;
};

type PlayState = "boot" | "ready" | "reveal" | "error" | "expired";

// Debug flag (same behavior as in api.ts)
const DEBUG =
  /[?&]debug=1/.test(globalThis.location?.search || "") ||
  (globalThis as any).__HS_DEBUG__ === true;

export default function App() {
  const [state, setState] = useState<PlayState>("boot");
  const [error, setError] = useState<string>("");
  const [c, setCase] = useState<CasePublic | null>(null);
  const [sid, setSid] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [tLeft, setTLeft] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [modal, setModal] = useState<
    | null
    | { kind: "signature" | "metadata"; payload: any }
    | { kind: "image"; src: string; label: "A" | "B" | "C" }
  >(null);
  const [leader, setLeader] = useState<any>(null);
  const countdownActive = state === "ready" && tLeft > 0;

  function push(msg: string) {
    if (!DEBUG) return;
    // eslint-disable-next-line no-console
    console.log("[UI]", msg);
    setLogs((p) => [...p, msg].slice(-400));
  }

  // boot
  useEffect(() => {
    (async () => {
      push("[Boot] DOMContentLoaded");
      push(`Booting Hidden Stroke… API base: ${API_BASE}`);

      try {
        const h = await health();
        push(`[Health] ${JSON.stringify(h)}`);
      } catch (e: any) {
        push(`[Health] FAILED: ${e?.message || e}`);
      }

      try {
        const payload = await startToday();
        push("startToday OK");
        const cp = payload.case as CasePublic;
        setCase(cp);
        setSid(payload.session_id as string);
        setTLeft(cp.timer_seconds | 0);
        setState("ready");
      } catch (e: any) {
        const msg = e?.message || String(e);
        push("startToday FAILED: " + msg);
        setError(msg);
        setState("error");
      }
    })();
  }, []);

  // countdown
  useEffect(() => {
    if (!countdownActive) return;
    const id = setInterval(() => {
      setTLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          setState("expired");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [countdownActive]);

  // Esc closes modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModal(null);
    }
    if (modal) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  // ----- UI states -----
  if (state === "boot") {
    return (
      <Shell>
        <Header />
        <p>Booting…</p>
        <SmallLog logs={logs} />
      </Shell>
    );
  }

  if (state === "error") {
    return (
      <Shell>
        <Header />
        <ErrorPane apiBase={API_BASE} error={error} logs={logs} />
      </Shell>
    );
  }

  if (!c || !sid) return null;

  const canGuess = pick !== null && state === "ready";

  return (
    <Shell>
      <Header />
      <p className="brief"><em>{c.brief}</em></p>

      {/* global tool tray */}
      <ToolTray
        disabled={state !== "ready"}
        timer={tLeft}
        onSignature={async () => {
          try {
            const [a, b, ct] = await compareSignature(c.case_id, sid);
            setModal({ kind: "signature", payload: { a, b, c: ct } });
          } catch (e: any) {
            alert(`Signature compare failed: ${e?.message || e}`);
          }
        }}
        onMetadata={async () => {
          try {
            const [a, b, ct] = await compareMetadata(c.case_id, sid);
            setModal({ kind: "metadata", payload: { a, b, c: ct } });
          } catch (e: any) {
            alert(`Metadata compare failed: ${e?.message || e}`);
          }
        }}
      />

      {/* 3-up gallery; tap image to open; tap card/caption to pick */}
      <div className="grid" role="list">
        {c.images.map((src, i) => {
          const label = (["A", "B", "C"] as const)[i];
          return (
            <figure
              key={i}
              role="listitem"
              className={`card ${pick === i ? "active" : ""}`}
              onClick={() => setPick(i)}
              aria-selected={pick === i}
            >
              <button
                className="imgBtn"
                onClick={(e) => {
                  e.stopPropagation();
                  setModal({ kind: "image", src, label });
                }}
                aria-label={`Open image ${label} full size`}
              >
                <img src={src} alt={`Artwork ${label}`} />
              </button>
              <figcaption>
                <span aria-hidden>{label}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {/* submit */}
      <div className="actions">
        <label htmlFor="rationale">Your rationale:</label>
        <input id="rationale" type="text" placeholder="Why is this authentic?" />
        <button
          disabled={!canGuess}
          onClick={async () => {
            try {
              const rationale = (document.getElementById("rationale") as HTMLInputElement)?.value || "";
              const resp = await submitGuess(c.case_id, sid, pick!, rationale);
              setModal({
                kind: "metadata", // reuse pane styling for a simple summary
                payload: {
                  a: { flags: [`Score: ${resp.score}`] },
                  b: { flags: [`Time left: ${resp.timeLeft}s`] },
                  c: { flags: [`IP left: ${resp.ipLeft}`] },
                },
              });
              setState("reveal");
              try {
                const lb = await getDailyLeaderboard();
                setLeader(lb);
              } catch {}
            } catch (e: any) {
              alert(`Guess failed: ${e?.message || e}`);
            }
          }}
        >
          Submit Guess {pick !== null ? `(pick ${["A", "B", "C"][pick]})` : ""}
        </button>
      </div>

      {/* reveal + leaderboard after guess */}
      {state === "reveal" && leader && (
        <div className="reveal">
          <h3>Daily Leaderboard</h3>
          <pre className="log">{JSON.stringify(leader, null, 2)}</pre>
        </div>
      )}

      {/* modals */}
      {modal && (
        <Modal onClose={() => setModal(null)}>
          {modal.kind === "signature" && <SignatureCompare crops={modal.payload} />}
          {modal.kind === "metadata" && <MetadataCompare flags={modal.payload} />}
          {modal.kind === "image" && <ImageModal src={modal.src} label={modal.label} onClose={() => setModal(null)} />}
        </Modal>
      )}

      {state === "expired" && <ExpiredBanner />}

      <SmallLog logs={logs} />
      <Styles />
    </Shell>
  );
}

// ---------------- components ----------------

function Header() {
  return <h1>Hidden Stroke</h1>;
}

function ToolTray({
  disabled,
  timer,
  onSignature,
  onMetadata,
}: {
  disabled: boolean;
  timer: number;
  onSignature: () => void;
  onMetadata: () => void;
}) {
  return (
    <div className="tray">
      <div className="tray-left">
        <button disabled={disabled} onClick={onSignature}>Signature (compare)</button>
        <button disabled={disabled} onClick={onMetadata}>Metadata (compare)</button>
      </div>
      <div className="tray-right">
        ⏱ <strong>{timer}s</strong>
      </div>
    </div>
  );
}

function SignatureCompare({ crops }: { crops: { a: any; b: any; c: any } }) {
  const items = useMemo(
    () => [
      { label: "A", url: crops.a?.crop_url, hint: crops.a?.hint },
      { label: "B", url: crops.b?.crop_url, hint: crops.b?.hint },
      { label: "C", url: crops.c?.crop_url, hint: crops.c?.hint },
    ],
    [crops]
  );
  return (
    <div>
      <h3>Signature Analyzer (compare)</h3>
      <div className="compare">
        {items.map((it) => (
          <div key={it.label} className="cell">
            <div className="cap">#{it.label}</div>
            {it.url ? <img src={it.url} alt={`Signature ${it.label}`} /> : <div className="empty">no crop</div>}
            <div className="hint">{it.hint || ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetadataCompare({ flags }: { flags: { a: any; b: any; c: any } }) {
  const items = [
    { label: "A", text: flags.a?.flags?.[0] || "-" },
    { label: "B", text: flags.b?.flags?.[0] || "-" },
    { label: "C", text: flags.c?.flags?.[0] || "-" },
  ];
  return (
    <div>
      <h3>Metadata Analysis (compare)</h3>
      <div className="compare">
        {items.map((it) => (
          <div key={it.label} className="cell">
            <div className="cap">#{it.label}</div>
            <div className="text">{it.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageModal({ src, label, onClose }: { src: string; label: "A" | "B" | "C"; onClose: () => void }) {
  return (
    <div>
      <h3 style={{marginTop:0}}>Artwork {label}</h3>
      <div className="imageWrap">
        <img src={src} alt={`Artwork ${label} (full view)`} />
      </div>
      <p style={{marginTop:8}}>
        <a href={src} target="_blank" rel="noreferrer">Open original</a>
      </p>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">✕</button>
        {children}
      </div>
    </div>
  );
}

function ExpiredBanner() {
  return (
    <div className="expired">
      Session expired — tools are disabled. You can still view images and submit a pick, but it may be rejected by the server if expired.
    </div>
  );
}

function ErrorPane({ apiBase, error, logs }: { apiBase: string; error: string; logs: string[] }) {
  if (!DEBUG) {
    return <p style={{ color: "#ff6b6b" }}>Something went wrong. Please try again.</p>;
  }
  return (
    <>
      <p style={{ color: "#ff6b6b" }}>Could not load today’s case. Load failed.</p>
      <p>API base: <code>{apiBase}</code></p>
      <pre className="err">{error || "Load failed"}</pre>
      <SmallLog logs={logs} />
    </>
  );
}

function SmallLog({ logs }: { logs: string[] }) {
  if (!DEBUG) return null;
  return (
    <details style={{ marginTop: 16 }} open>
      <summary>RedStroke Logs</summary>
      <pre className="log">{logs.join("\n")}</pre>
    </details>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="wrap">{children}</div>;
}

function Styles() {
  return (
    <style>{`
      .wrap { padding:16px; background:#0d0d0f; color:#e6e6e6; font-family: ui-sans-serif, system-ui; }
      h1 { margin:0 0 8px }
      .brief { margin:6px 0 14px; color:#d6e7ff }

      .tray { position:sticky; top:0; z-index:3; display:flex; justify-content:space-between; align-items:center; padding:8px; margin-bottom:10px; background:#121214; border:1px solid #1f1f22; border-radius:10px }
      .tray button { margin-right:8px; background:#0ea5e9; border:none; color:#001018; padding:8px 12px; border-radius:8px; font-weight:600 }
      .tray-right { color:#9be7ff }

      .grid { display:grid; gap:12px; grid-template-columns: 1fr; }
      @media(min-width:720px){ .grid{ grid-template-columns: repeat(3, 1fr); } }

      .card { background:#16161a; border:2px solid #25252a; border-radius:10px; overflow:hidden; cursor:pointer; }
      .card.active { border-color:#0ea5e9; box-shadow:0 0 0 2px #0ea5e966 inset }
      .card figcaption { padding:8px; text-align:center; color:#b7c0ce; font-weight:600 }
      .card img { width:100%; display:block; background:#000 }

      .imgBtn { display:block; padding:0; border:0; background:transparent; width:100%; cursor:zoom-in; }
      .imgBtn:focus-visible { outline: 2px solid #0ea5e9; outline-offset: 2px; }

      .actions { margin-top:14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      .actions label { display:block; }
      .actions input { padding:8px 10px; border-radius:8px; border:1px solid #2c2c31; background:#0b0b0d; color:#e6e6e6; width: min(380px, 90vw); }
      .actions button { background:#16a34a; border:none; color:white; padding:8px 12px; border-radius:8px; font-weight:700 }

      .log { max-height:200px; overflow:auto; background:#0b0b0d; padding:10px; border:1px solid #1e1e22; border-radius:8px; }
      .err { white-space: pre-wrap; background:#1b0f10; border:1px solid #392024; padding:8px; border-radius:8px; }
      .reveal { margin-top:12px; padding:12px; background:#121214; border:1px solid #1f1f22; border-radius:10px; }
      .expired { margin:12px 0; padding:10px; background:#201317; border:1px solid #47212a; border-radius:8px; color:#ffc9c9 }

      /* modal */
      .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:999; }
      .modal { width:min(1200px, 96vw); max-height:92vh; overflow:auto; background:#0f0f12; border:1px solid #23232a; border-radius:12px; padding:16px; position:relative; }
      .modal .x { position:absolute; top:8px; right:8px; background:#222; color:#ddd; border:none; border-radius:6px; padding:6px 10px; }
      .compare { display:grid; grid-template-columns: 1fr; gap:12px; }
      @media(min-width:720px){ .compare{ grid-template-columns: repeat(3, 1fr);} }
      .cell { background:#121214; border:1px solid #1f1f22; border-radius:8px; padding:8px; }
      .cell img { width:100%; border-radius:6px; background:#000 }
      .cell .cap { font-weight:700; color:#a5b4fc; margin-bottom:6px; }
      .cell .hint { margin-top:6px; color:#9be7ff }
      .cell .text { white-space: pre-wrap; color:#e8f6ff }
      .empty { height:200px; display:flex; align-items:center; justify-content:center; color:#888; background:#090909; border-radius:6px; border:1px dashed #333; }

      /* large image */
      .imageWrap { width:100%; display:flex; justify-content:center; }
      .imageWrap img { width:100%; height:auto; max-width:1200px; border-radius:10px; }
    `}</style>
  );
}
