import { ASSETS } from '../lib/assets';

export default function AssetPicker({ value, onChange, disabled }) {
  return (
    <fieldset className="asset-picker" disabled={disabled}>
      <legend className="field-label">Receive</legend>
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
              <img src={asset.mark} alt="" width="56" height="56" />
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
