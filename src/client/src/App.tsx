import React, { useEffect, useState } from "react";
import { API_BASE, startToday, callToolSignature } from "./api";

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
  tool_costs: any;
  credits: any;
};

export default function App() {
  const [status, setStatus] = useState<"boot"|"ready"|"error">("boot");
  const [error, setError] = useState<string>("");
  const [caseData, setCaseData] = useState<CasePublic | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  function push(msg: string) {
    console.log("[UI]", msg);
    setLogs(prev => [...prev, msg].slice(-200));
  }

  useEffect(() => {
    (async () => {
      push(`Booting Hidden Stroke… API base: ${API_BASE}`);
      try {
        const user = detectUser();
        push(`User: ${JSON.stringify(user)}`);
        const payload = await startToday(user);
        push("startToday OK");
        setCaseData(payload.case as CasePublic);
        setSessionId(payload.session_id);
        setStatus("ready");
      } catch (e: any) {
        const msg = e?.message || String(e);
        push("startToday FAILED: " + msg);
        setError(msg);
        setStatus("error");
      }
    })();
  }, []);

  function detectUser() {
    // Devvit injects a token; in practice we’ll just fabricate a stable anon id.
    const id = (globalThis as any).__hs_uid || (globalThis as any).__hs_uid = ("anon-" + Math.random().toString(36).slice(2));
    const name = (globalThis as any).__hs_uname || (globalThis as any).__hs_uname = "anon";
    return { id, name };
  }

  if (status === "boot") {
    return (
      <div className="wrap">
        <h1>Hidden Stroke</h1>
        <p>Booting…</p>
        <SmallLog logs={logs} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="wrap">
        <h1>Hidden Stroke</h1>
        <p style={{color:"#ff6b6b"}}>Could not load today’s case. Load failed</p>
        <p>API base: <code>{API_BASE}</code></p>
        <pre className="err">{error}</pre>
        <SmallLog logs={logs} />
      </div>
    );
  }

  // ready
  const c = caseData!;
  return (
    <div className="wrap">
      <h1>Hidden Stroke</h1>
      <p><em>{c.brief}</em></p>
      <p><strong>Mode:</strong> {c.mode} · <strong>Timer:</strong> {c.timer_seconds}s</p>
      <div className="grid">
        {c.images.map((src, i) => (
          <figure key={i} className="card">
            <img src={src} alt={`image ${i+1}`} />
            <figcaption>
              <button onClick={async () => {
                try {
                  if (!sessionId) throw new Error("no session id");
                  const resp = await callToolSignature(c.case_id, sessionId, i);
                  push(`[tool/signature] i=${i} -> OK`);
                  alert(`Signature hint: ${resp.hint || ""}\nCrop: ${resp.crop_url || ""}`);
                } catch (e: any) {
                  push(`[tool/signature] i=${i} FAILED: ${e?.message || e}`);
                  alert(`Signature tool failed: ${e?.message || e}`);
                }
              }}>Signature Analyzer</button>
            </figcaption>
          </figure>
        ))}
      </div>
      <SmallLog logs={logs} />
    </div>
  );
}

function SmallLog({ logs }: { logs: string[] }) {
  return (
    <details style={{marginTop:16}}>
      <summary>Client logs</summary>
      <pre className="log">{logs.join("\n")}</pre>
    </details>
  );
}
