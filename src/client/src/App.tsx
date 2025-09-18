// src/client/App.tsx
import React, { useEffect, useState } from "react";
import {
  API_BASE,
  health,
  startToday,
  callToolSignature,
  callToolMetadata,
  callToolFinancial,
  submitGuess,
  getDailyLeaderboard,
  type CasePublic,
} from "./api";

type PlayState = "boot" | "ready" | "reveal" | "error";

export default function App() {
  const [state, setState] = useState<PlayState>("boot");
  const [error, setError] = useState<string>("");
  const [caseData, setCaseData] = useState<CasePublic | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selection, setSelection] = useState<number | null>(null);
  const [toolHint, setToolHint] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [reveal, setReveal] = useState<any>(null);
  const [leader, setLeader] = useState<any>(null);

  function push(msg: string) {
    console.log("[UI]", msg);
    setLogs((p) => [...p, msg].slice(-400));
  }

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
        setCaseData(payload.case as CasePublic);
        setSessionId(payload.session_id as string);
        setState("ready");
      } catch (e: any) {
        const msg = e?.message || String(e);
        push("startToday FAILED: " + msg);
        setError(msg);
        setState("error");
      }
    })();
  }, []);

  if (state === "boot") {
    return (
      <Shell>
        <h1>Hidden Stroke</h1>
        <p>Booting…</p>
        <SmallLog logs={logs} />
      </Shell>
    );
  }

  if (state === "error") {
    return (
      <Shell>
        <h1>Hidden Stroke</h1>
        <p style={{ color: "#ff6b6b" }}>Could not load today’s case. Load failed.</p>
        <p>
          API base: <code>{API_BASE}</code>
        </p>
        <pre className="err">{error || "Load failed"}</pre>
        <SmallLog logs={logs} />
      </Shell>
    );
  }

  const c = caseData!;
  const canGuess = selection !== null && !!sessionId;

  return (
    <Shell>
      <h1>Hidden Stroke</h1>
      <p>
        <em>{c.brief}</em>
      </p>
      <p>
        <strong>Mode:</strong> {c.mode} · <strong>Timer:</strong> {c.timer_seconds}s
      </p>

      <div className="grid">
        {c.images.map((src, i) => (
          <figure key={i} className={`card ${selection === i ? "active" : ""}`}>
            <img src={src} alt={`image ${i + 1}`} onClick={() => setSelection(i)} />
            <figcaption>
              <div className="row">
                <button
                  onClick={async () => {
                    try {
                      if (!sessionId) throw new Error("no session id");
                      const resp = await callToolSignature(c.case_id, sessionId, i);
                      push(`[tool/signature] i=${i} -> OK`);
                      setToolHint(`Signature hint: ${resp.hint || ""}`);
                      alert(`Signature hint: ${resp.hint || ""}\nCrop: ${resp.crop_url || ""}`);
                    } catch (e: any) {
                      push(`[tool/signature] i=${i} FAILED: ${e?.message || e}`);
                      alert(`Signature tool failed: ${e?.message || e}`);
                    }
                  }}
                >
                  Signature
                </button>
                <button
                  onClick={async () => {
                    try {
                      if (!sessionId) throw new Error("no session id");
                      const resp = await callToolMetadata(c.case_id, sessionId, i);
                      push(`[tool/metadata] i=${i} -> OK`);
                      alert(`Metadata hint: ${(resp.flags && resp.flags[0]) || ""}`);
                    } catch (e: any) {
                      push(`[tool/metadata] i=${i} FAILED: ${e?.message || e}`);
                      alert(`Metadata tool failed: ${e?.message || e}`);
                    }
                  }}
                >
                  Metadata
                </button>
                <button
                  onClick={async () => {
                    try {
                      if (!sessionId) throw new Error("no session id");
                      const resp = await callToolFinancial(c.case_id, sessionId);
                      push(`[tool/financial] -> OK`);
                      alert(`Financial hint: ${(resp.flags && resp.flags[0]) || ""}`);
                    } catch (e: any) {
                      push(`[tool/financial] FAILED: ${e?.message || e}`);
                      alert(`Financial tool failed: ${e?.message || e}`);
                    }
                  }}
                >
                  Financial
                </button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

      {toolHint && <p className="hint">🔎 {toolHint}</p>}

      <div className="actions">
        <label>
          Your rationale:
          <input id="rationale" type="text" placeholder="Why is this authentic?" />
        </label>
        <button
          disabled={!canGuess}
          onClick={async () => {
            try {
              if (!sessionId || selection === null) return;
              const rationale = (document.getElementById("rationale") as HTMLInputElement)?.value || "";
              const resp = await submitGuess(c.case_id, sessionId, selection, rationale);
              setReveal(resp.reveal);
              setState("reveal");
              push(`[guess] -> ${resp.correct ? "CORRECT" : "WRONG"} score=${resp.score}`);
              try {
                const lb = await getDailyLeaderboard();
                setLeader(lb);
              } catch (e) {
                // leaderboard is best-effort in mock
              }
            } catch (e: any) {
              alert(`Guess failed: ${e?.message || e}`);
            }
          }}
        >
          Submit Guess {selection !== null ? `(pick ${selection + 1})` : ""}
        </button>
      </div>

      {state === "reveal" && reveal && (
        <div className="reveal">
          <h2>Reveal</h2>
          <p>
            Authentic index: <strong>{(reveal.authentic_index as number) + 1}</strong>
          </p>
          <p>{reveal.explanation}</p>
          <ul>
            <li>Signature: {reveal.flags_signature?.[0] || "-"}</li>
            <li>Metadata: {reveal.flags_metadata?.[0] || "-"}</li>
            <li>Financial: {reveal.flags_financial?.[0] || "-"}</li>
          </ul>

          {leader && (
            <>
              <h3>Daily Leaderboard</h3>
              <pre className="log">{JSON.stringify(leader, null, 2)}</pre>
            </>
          )}
        </div>
      )}

      <SmallLog logs={logs} />
    </Shell>
  );
}

// ---------------- small helpers / layout ----------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap">
      {children}
      <style>{`
        .wrap { padding: 16px; color: #e6e6e6; background:#111; font-family: ui-sans-serif, system-ui; }
        h1 { margin: 0 0 8px; }
        .grid { display:grid; grid-template-columns: 1fr; gap:12px; }
        @media(min-width:700px){ .grid { grid-template-columns: repeat(3, 1fr); } }
        .card { background:#1c1c1c; border:1px solid #2a2a2a; padding:8px; border-radius:8px; }
        .card.active { outline: 2px solid #0ea5e9; }
        img { width:100%; height:auto; object-fit:cover; border-radius:4px; background:#000; }
        .row { display:flex; gap:8px; flex-wrap:wrap; }
        button { background:#0ea5e9; border:none; color:#001018; padding:8px 12px; border-radius:6px; font-weight:600; }
        button:disabled { opacity:.5 }
        .actions { margin-top:12px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .actions input { padding:6px 8px; border-radius:6px; border:1px solid #333; background:#0b0b0b; color:#eee; }
        .hint { margin: 8px 0; color:#9be7ff; }
        .reveal { margin-top: 16px; padding: 12px; background:#161616; border:1px solid #2a2a2a; border-radius:8px; }
        .log { max-height: 200px; overflow:auto; background:#0b0b0b; padding:8px; border-radius:6px; border:1px solid #222; }
        .err { white-space: pre-wrap; background:#1c0000; border:1px solid #331111; padding:8px; border-radius:6px; }
      `}</style>
    </div>
  );
}

function SmallLog({ logs }: { logs: string[] }) {
  return (
    <details style={{ marginTop: 16 }} open>
      <summary>Client logs</summary>
      <pre className="log">{logs.join("\n")}</pre>
    </details>
  );
}
