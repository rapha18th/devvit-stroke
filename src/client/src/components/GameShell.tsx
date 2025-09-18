import React from 'react';
import type { ToolCosts } from '../types';

type Props = {
  brief: string;
  ip: number;
  timer: number;
  toolCosts: ToolCosts;
  mode: 'knowledge' | 'observation';
  onToolSignature: () => void;
  onToolMetadata: () => void;
  onToolFinancial: () => void;
  disabled?: boolean;
};

export default function GameShell({
  brief, ip, timer, toolCosts, mode,
  onToolSignature, onToolMetadata, onToolFinancial, disabled
}: Props) {
  return (
    <div className="shell">
      <div className="shell-bar">
        <div className="chip">⏱ {timer}s</div>
        <div className="chip">🕵️ IP: {ip}</div>
        <div className="chip">{mode === 'knowledge' ? 'Knowledge Case' : 'Observation Case'}</div>
      </div>
      <p className="brief">{brief}</p>
      <div className="tools">
        <button
          className="tool-btn"
          disabled={disabled}
          onClick={onToolSignature}
          title="Signature Analyzer"
        >
          Signature Analyzer <span className="cost">−{toolCosts.signature}</span>
        </button>
        <button
          className="tool-btn"
          disabled={disabled}
          onClick={onToolMetadata}
          title="Metadata Scanner"
        >
          Metadata Scanner <span className="cost">−{toolCosts.metadata}</span>
        </button>
        <button
          className="tool-btn"
          disabled={disabled}
          onClick={onToolFinancial}
          title="Financial Audit AI"
        >
          Financial Audit AI <span className="cost">−{toolCosts.financial}</span>
        </button>
      </div>
    </div>
  );
}
