import React from 'react';
import type { CaseMetadata } from '../types';

type Props = {
  meta: CaseMetadata[];
  ledgerSummary: string;
};

const labels = ['A', 'B', 'C'];

export default function MetadataTable({ meta, ledgerSummary }: Props) {
  return (
    <div className="table-wrap">
      <table className="meta-table">
        <thead>
          <tr>
            <th>Field</th>
            {labels.map((l) => <th key={l}>{l}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Title</td>
            {meta.map((m, i) => <td key={i}>{m.title}</td>)}
          </tr>
          <tr>
            <td>Year</td>
            {meta.map((m, i) => <td key={i}>{m.year}</td>)}
          </tr>
          <tr>
            <td>Medium</td>
            {meta.map((m, i) => <td key={i}>{m.medium}</td>)}
          </tr>
          <tr>
            <td>Ink/Pigment</td>
            {meta.map((m, i) => <td key={i}>{m.ink_or_pigment}</td>)}
          </tr>
          <tr>
            <td>Catalog Ref</td>
            {meta.map((m, i) => <td key={i}>{m.catalog_ref}</td>)}
          </tr>
          <tr>
            <td>Ownership</td>
            {meta.map((m, i) => <td key={i}>{m.ownership_chain.join(' → ')}</td>)}
          </tr>
          <tr>
            <td>Notes</td>
            {meta.map((m, i) => <td key={i}>{m.notes}</td>)}
          </tr>
        </tbody>
      </table>

      <div className="ledger">
        <h4>Financial Ledger Summary</h4>
        <p>{ledgerSummary}</p>
      </div>
    </div>
  );
}
