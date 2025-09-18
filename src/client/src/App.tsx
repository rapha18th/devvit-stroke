import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  API_BASE, health, startCase, toolSignature, toolMetadata,
  toolFinancial, submitGuess, leaderboardDaily, StartCaseResponse
} from './api';

type ToolHints = {
  crop_url?: string;
  meta_hint?: string;
  fin_hint?: string;
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<StartCaseResponse | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [ip, setIp] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [tool, setTool] = useState<ToolHints>({});
  const [guessing, setGuessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [lb, setLb] = useState<any>(null);

  // mount: ping + startCase
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await health();
        const sc = await startCase();
        console.log('[HiddenStroke] startCase', sc);
        setData(sc);
        setIp(sc.case.initial_ip);
        setSecondsLeft(sc.case.timer_seconds);
        setErr(null);
      } catch (e: any) {
        console.error('[HiddenStroke] boot error', e?.message || e);
        setErr('Could not load today’s case. ' + (e?.message || ''));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // simple countdown (client-side only; server enforces expiry)
  useEffect(() => {
    if (secondsLeft == null) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => (s && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const caseId = data?.case.case_id ?? '';
  const sessionId = data?.session_id ?? '';
  const disabled = !data || !!result || (secondsLeft !== null && secondsLeft <= 0);

  async function useSignature() {
    if (selected == null || !caseId) return;
    try {
      const r = await toolSignature(caseId, selected);
      setTool((t) => ({ ...t, crop_url: r.crop_url }));
      setIp(r.ip_remaining ?? ip);
    } catch (e:any) {
      setErr('Signature tool failed: ' + (e?.message || e));
    }
  }

  async function useMeta() {
    if (selected == null || !caseId) return;
    try {
      const r = await toolMetadata(caseId, selected);
      const hint = (r.flags && r.flags[0]) || '';
      setTool((t) => ({ ...t, meta_hint: hint }));
      setIp(r.ip_remaining ?? ip);
    } catch (e:any) {
      setErr('Metadata tool failed: ' + (e?.message || e));
    }
  }

  async function useFinancial() {
    if (!caseId) return;
    try {
      const r = await toolFinancial(caseId);
      const hint = (r.flags && r.flags[0]) || '';
      setTool((t) => ({ ...t, fin_hint: hint }));
      setIp(r.ip_remaining ?? ip);
    } catch (e:any) {
      setErr('Financial tool failed: ' + (e?.message || e));
    }
  }

  async function doGuess() {
    if (selected == null || !caseId) return;
    setGuessing(true);
    try {
      const r = await submitGuess(caseId, selected, 'My pick');
      setResult(r);
      const board = await leaderboardDaily();
      setLb(board);
    } catch (e:any) {
      setErr('Guess failed: ' + (e?.message || e));
    } finally {
      setGuessing(false);
    }
  }

  if (loading) return screenShell(<p>Loading…</p>);
  if (err) return screenShell(
    <>
      <p className="error">{err}</p>
      <p className="muted">API base: <code>{API_BASE}</code></p>
    </>
  );
  if (!data) return screenShell(<p className="error">No data.</p>);

  const c = data.case;

  return screenShell(
    <div className="container">
      <header className="hdr">
        <div className="title">
          <h1>Hidden Stroke — Daily Case</h1>
          <div className="sub">{c.style_period}</div>
        </div>
        <div className="statbar">
          <Stat label="Mode" value={c.mode} />
          <Stat label="IP" value={ip ?? c.initial_ip} />
          <Stat label="Time" value={fmtTime(secondsLeft ?? c.timer_seconds)} />
          <Stat label="Session" value={sessionId.slice(0, 8)} />
        </div>
      </header>

      <section className="brief">
        <p>{c.brief}</p>
      </section>

      <section className="images">
        {c.images.map((url, i) => (
          <button
            key={i}
            className={'card ' + (selected === i ? 'sel' : '')}
            onClick={() => setSelected(i)}
            disabled={disabled}
            title={`Select image ${String.fromCharCode(65 + i)}`}
          >
            <img src={url} alt={`Artwork ${i+1}`} />
            <div className="badge">{String.fromCharCode(65 + i)}</div>
          </button>
        ))}
      </section>

      <section className="tools">
        <h3>Tools</h3>
        <div className="toolrow">
          <button onClick={useSignature} disabled={selected==null || disabled}>Signature Analyzer</button>
          <button onClick={useMeta} disabled={selected==null || disabled}>Metadata Scanner</button>
          <button onClick={useFinancial} disabled={disabled}>Financial Audit AI</button>
        </div>

        <div className="toolout">
          {tool.crop_url && (
            <div className="panel">
              <div className="panelhdr">Signature Macro (zoom)</div>
              <img className="crop" src={tool.crop_url} alt="signature crop"/>
            </div>
          )}
          {tool.meta_hint && (
            <div className="panel">
              <div className="panelhdr">Metadata hint</div>
              <p>{tool.meta_hint}</p>
            </div>
          )}
          {tool.fin_hint && (
            <div className="panel">
              <div className="panelhdr">Financial hint</div>
              <p>{tool.fin_hint}</p>
            </div>
          )}
        </div>
      </section>

      <section className="meta">
        <h3>Catalog Metadata (A / B / C)</h3>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>A</th>
                <th>B</th>
                <th>C</th>
              </tr>
            </thead>
            <tbody>
              {tableRows(c.metadata).map(([k, vals]) => (
                <tr key={k}>
                  <td className="key">{k}</td>
                  {vals.map((v, i) => <td key={i} className="val">{renderVal(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ledger">
          <h4>Ledger summary</h4>
          <p>{c.ledger_summary}</p>
        </div>
      </section>

      <section className="actions">
        <button className="primary"
          disabled={selected==null || disabled || guessing}
          onClick={doGuess}
        >
          {guessing ? 'Submitting…' : selected==null ? 'Pick A/B/C' : `Lock in ${String.fromCharCode(65+(selected??0))}`}
        </button>
      </section>

      {result && (
        <section className="reveal">
          <h3>Result</h3>
          <p><b>{result.correct ? '✅ Correct!' : '❌ Not quite.'}</b> Score: <b>{result.score}</b></p>
          <p><b>Authentic:</b> {String.fromCharCode(65 + (result.reveal?.authentic_index ?? 0))}</p>
          <details>
            <summary>Explanation</summary>
            <p>{result.reveal?.explanation}</p>
            {!!(result.reveal?.flags_signature?.length) && (
              <>
                <h4>Signature flags</h4>
                <ul>{result.reveal.flags_signature.map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>
              </>
            )}
            {!!(result.reveal?.flags_metadata?.length) && (
              <>
                <h4>Metadata flags</h4>
                <ul>{result.reveal.flags_metadata.map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>
              </>
            )}
            {!!(result.reveal?.flags_financial?.length) && (
              <>
                <h4>Financial flags</h4>
                <ul>{result.reveal.flags_financial.map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>
              </>
            )}
          </details>
        </section>
      )}

      {lb && (
        <section className="leaderboard">
          <h3>Today’s Leaderboard</h3>
          <div className="tablewrap">
            <table>
              <thead><tr><th>#</th><th>User</th><th>Score</th><th>When</th></tr></thead>
              <tbody>
              {(lb.top || []).map((r:any, i:number) => (
                <tr key={r.user_id}>
                  <td>{i+1}</td>
                  <td>{r.username}</td>
                  <td>{r.score}</td>
                  <td>{new Date(r.ts).toLocaleTimeString()}</td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
          {lb.me?.rank && <p className="muted">Your rank: {lb.me.rank}</p>}
        </section>
      )}

      <footer className="ftr">
        <span>API: <code>{API_BASE}</code></span>
        <span>Case: <code>{c.case_id}</code></span>
      </footer>
    </div>
  );
}

/* ---------- helpers / UI bits ---------- */

function screenShell(children: React.ReactNode) {
  return (
    <div className="shell">
      <div className="container">
        <header className="hdr"><h1>Hidden Stroke</h1></header>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}

function Stat({label, value}:{label:string; value:any}) {
  return (
    <div className="stat">
      <div className="k">{label}</div>
      <div className="v">{String(value)}</div>
    </div>
  );
}

function fmtTime(s: number | null) {
  if (s == null) return '--:--';
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const ss = (s%60).toString().padStart(2,'0');
  return `${m}:${ss}`;
}

function tableRows(metas: Array<Record<string, any>>): Array<[string, any[]]> {
  const keys = new Set<string>();
  metas.forEach(m => Object.keys(m).forEach(k => keys.add(k)));
  const rows: Array<[string, any[]]> = [];
  [...keys].forEach(k => {
    rows.push([k, metas.map(m => m[k])]);
  });
  return rows;
}

function renderVal(v:any) {
  if (Array.isArray(v)) return v.join(' → ');
  if (v && typeof v === 'object') return JSON.stringify(v);
  return String(v ?? '');
}
