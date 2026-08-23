import { useEffect, useRef, useState } from 'react';
import { ASSETS, getAsset } from '../lib/assets';
import AssetGlyph from './AssetGlyph';

export default function AssetPicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const current = getAsset(value);

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [value]);

  return (
    <div className="asset-menu pair-left" ref={wrapRef}>
      <button
        type="button"
        className="pair-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Selected asset ${current.symbol}`}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pair-code">
          <AssetGlyph tint={current.tint} size={22} />
          {current.symbol}
          <span className="chev">▾</span>
        </span>
        <span className="pair-name">
          {current.name}
          <span className="pair-tag">{current.symbol}</span>
        </span>
      </button>
      {open && (
        <div className="asset-menu-list" role="listbox" aria-label="Choose asset">
          {ASSETS.map((asset) => (
            <button
              key={asset.value}
              type="button"
              role="option"
              aria-selected={value === asset.value}
              className={value === asset.value ? 'selected' : ''}
              onClick={() => {
                onChange(asset.value);
                setOpen(false);
              }}
            >
              <AssetGlyph tint={asset.tint} size={20} />
              {asset.symbol}
              <span>{asset.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
