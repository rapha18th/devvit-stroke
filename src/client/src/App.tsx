import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './styles.css';
import { useCountdown } from './hooks/useCountdown';
import {
  apiStartToday,
  apiToolSignature,
  apiToolMetadata,
  apiToolFinancial,
  apiGuess,
  apiLeaderboardDaily
} from './api';
import type { CasePublic, LeaderboardDaily } from './types';
import GameShell from './components/GameShell';
import ImageGrid from './components/ImageGrid';
import MetadataTable from './components/MetadataTable';
import Modal from './components/Modal';
import Toast from './components/Toast';

const ALLOW_DEV = (import.meta.env.VITE_ALLOW_DEV as string) === '1';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameCase, setGameCase] = useState<CasePublic | null>(null);

  const [ip, setIp] = useState<number>(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  const [sigOpen, setSigOpen] = useState(false);
  const [sigUrl, setSigUrl] = useState<string | null>(null);
  const [sigHint, setSigHint] = useState<string | null>(null);

  const [hintOpen, setHintOpen] = useState(false);
  const [hints, setHints] = useState<string[]>([]);

  const [resultOpen, setResultOpen] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof apiGuess>> | null>(null);

  const [lb, setLb] = useState<LeaderboardDaily | null>(null);

  const [error, setError] = useState<string | null>(null);

  // boot: start case
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await apiStartToday();
        setSessionId(data.session_id);
        setGameCase(data.case);
        setIp(data.case.initial_ip);
      } catch (e: any) {
        setError(e.message || 'Failed to start case.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const timerTotal = gameCase?.timer_seconds ?? 90;
  const onTimesUp = useCallback(() => {
    // We don't auto-submit; server will enforce expiration.
    setError('⏱ Time is up.');
  }, []);
  const remaining = useCountdown(gameCase ? timerTotal : 0, onTimesUp);
  const disabled = useMemo(
    () => !sessionId || !gameCase || resultOpen || (remaining <= 0),
    [sessionId, gameCase, resultOpen, remaining]
  );

  // tools
  const doSignature = async () => {
    if (!sessionId || !gameCase) return;
    try {
      const idx = selected ?? 0; // default to A if they didn't choose a focus
      const res = await apiToolSignature(sessionId, gameCase.case_id, idx);
      setIp(res.ip_remaining);
      setSigUrl(res.crop_url);
      setSigHint(res.hint || null);
      setSigOpen(true);
    } catch (e: any) {
      setError(e.message || 'Signature tool failed.');
    }
  };

  const doMetadata = async () => {
    if (!sessionId || !gameCase) return;
    try {
      const idx = selected ?? 0;
      const res = await apiToolMetadata(sessionId, gameCase.case_id, idx);
      setIp(res.ip_remaining);
      setHints(res.flags || []);
      setHintOpen(true);
    } catch (e: any) {
      setError(e.message || 'Metadata tool failed.');
    }
  };

  const doFinancial = async () => {
    if (!sessionId || !gameCase) return;
    try {
      const res = await apiToolFinancial(sessionId, gameCase.case_id);
      setIp(res.ip_remaining);
      setHints(res.flags || []);
      setHintOpen(true);
    } catch (e: any) {
      setError(e.message || 'Financial tool failed.');
    }
  };

  // guess
  const choose = (i: number) => setSelected(i);

  const submitGuess = async () => {
    if (!sessionId || !gameCase || selected == null) {
      setError('Pick A/B/C first.');
      return;
    }
    try {
      const res = await apiGuess(sessionId, gameCase.case_id, selected);
      setResult(res);
      setResultOpen(true);
      // Pull leaderboard
      const dlb = await apiLeaderboardDaily();
      setLb(dlb);
    } catch (e: any) {
      setError(e.message || 'Guess failed.');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <p>Loading case…</p>
      </div>
    );
  }
  if (!gameCase || !sessionId) {
    return (
      <div className="container">
        <p>Could not load today’s case.</p>
      </div>
    );
  }

  const youRank = lb?.me?.rank ? `#${lb?.me?.rank}` : '—';

  return (
    <div className="container">
      <GameShell
        brief={gameCase.brief}
        ip={ip}
        timer={remaining}
        toolCosts={gameCase.tool_costs}
        mode={gameCase.mode}
        onToolSignature={doSignature}
        onToolMetadata={doMetadata}
        onToolFinancial={doFinancial}
        disabled={disabled}
      />

      <ImageGrid
        images={gameCase.images}
        onZoom={(i) => setZoomIndex(i)}
        selected={selected}
        onSelect={choose}
        disabled={disabled}
      />

      <div className="actions">
        <button className="primary" onClick={submitGuess} disabled={disabled || selected == null}>
          Submit Guess {selected != null ? `(${['A','B','C'][selected]})` : ''}
        </button>
        <button
          className="secondary"
          onClick={() => window.location.reload()}
          title="Restart page"
        >
          Restart
        </button>
      </div>

      <MetadataTable meta={gameCase.metadata} ledgerSummary={gameCase.ledger_summary} />

      {/* Zoom modal for A/B/C */}
      <Modal open={zoomIndex !== null} onClose={() => setZoomIndex(null)} title={`Zoom ${['A','B','C'][zoomIndex ?? 0]}`}>
        {zoomIndex !== null && (
          <img src={gameCase.images[zoomIndex]} alt={`Zoom ${zoomIndex}`} />
        )}
      </Modal>

      {/* Signature tool */}
      <Modal open={sigOpen} onClose={() => setSigOpen(false)} title="Signature Analyzer">
        {sigUrl ? <img src={sigUrl} alt="Signature crop" /> : <p>No crop available.</p>}
        {sigHint && <div className="hint">Hint: {sigHint}</div>}
      </Modal>

      {/* Hints modal (metadata / financial) */}
      <Modal open={hintOpen} onClose={() => setHintOpen(false)} title="Analysis Hints">
        {hints.length ? hints.map((h, i) => <div className="hint" key={i}>• {h}</div>) : <p>No hints.</p>}
      </Modal>

      {/* Result & leaderboard */}
      <Modal open={resultOpen} onClose={() => setResultOpen(false)} title="Reveal">
        {result && (
          <>
            <div className={`result ${result.correct ? 'good' : 'bad'}`}>
              <h3>{result.correct ? 'Correct!' : 'Not this time.'}</h3>
              <p>Score: <b>{result.score}</b> • Time left: {result.timeLeft}s • IP left: {result.ipLeft}</p>
              <p>Authentic: <b>{['A','B','C'][result.reveal.authentic_index]}</b></p>
              <p style={{ color: '#9aa3b2' }}>{result.reveal.explanation}</p>
              <div style={{ marginTop: 8 }}>
                <details>
                  <summary>Signature flags</summary>
                  <ul>{result.reveal.flags_signature.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </details>
                <details>
                  <summary>Metadata flags</summary>
                  <ul>{result.reveal.flags_metadata.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </details>
                <details>
                  <summary>Financial flags</summary>
                  <ul>{result.reveal.flags_financial.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </details>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4>Daily Leaderboard {lb ? `(you: ${youRank})` : ''}</h4>
              {!lb && <p>Loading…</p>}
              {lb && (
                <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #223047', borderRadius: 8 }}>
                  <table className="meta-table">
                    <thead>
                      <tr>
                        <th>#</th><th>User</th><th>Score</th><th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lb.top.map((r, i) => (
                        <tr key={r.user_id}>
                          <td>{i + 1}</td>
                          <td>{r.username}</td>
                          <td>{r.score}</td>
                          <td>{new Date(r.ts).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      {ALLOW_DEV && (
        <details style={{ marginTop: 16 }}>
          <summary>Dev: Raw Case JSON</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(gameCase, null, 2)}</pre>
        </details>
      )}

      <Toast msg={error} onClear={() => setError(null)} />
    </div>
  );
}
