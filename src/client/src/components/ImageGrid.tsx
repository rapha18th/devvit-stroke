import React, { useState } from 'react';

type Props = {
  images: string[];
  onZoom: (index: number) => void;
  selected?: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
};

const labels = ['A', 'B', 'C'];

export default function ImageGrid({ images, onZoom, selected, onSelect, disabled }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="grid">
      {images.map((url, i) => (
        <div
          key={i}
          className={`card ${selected === i ? 'selected' : ''} ${hover === i ? 'hover' : ''}`}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <div className="card-header">
            <div className="badge">{labels[i]}</div>
            <div className="card-actions">
              <button className="icon-btn" onClick={() => onZoom(i)} aria-label="Zoom">🔎</button>
            </div>
          </div>
          <img src={url} className="art" alt={`Candidate ${labels[i]}`} />
          <button
            className="pick-btn"
            onClick={() => onSelect(i)}
            disabled={disabled}
            title={`Choose ${labels[i]} as authentic`}
          >
            Choose {labels[i]}
          </button>
        </div>
      ))}
    </div>
  );
}
