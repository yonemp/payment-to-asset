import { ASSETS } from '../lib/assets';
import AssetGlyph from './AssetGlyph';

export default function AssetPicker({ value, onChange, disabled }) {
  return (
    <fieldset className="asset-picker" disabled={disabled}>
      <legend className="field-label">They receive</legend>
      <div className="asset-grid" role="radiogroup" aria-label="Asset">
        {ASSETS.map((asset) => {
          const selected = value === asset.value;
          return (
            <button
              key={asset.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`asset-card tint-${asset.tint}${selected ? ' selected' : ''}`}
              onClick={() => onChange(asset.value)}
            >
              <AssetGlyph tint={asset.tint} />
              <div className="asset-copy">
                <strong>{asset.symbol}</strong>
                <span>{asset.network}</span>
                <em>{asset.addressHint}</em>
              </div>
              <span className="asset-check" aria-hidden="true">
                {selected ? '●' : '○'}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
