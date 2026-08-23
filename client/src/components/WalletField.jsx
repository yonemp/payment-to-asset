import { getAsset, validateAddress } from '../lib/assets';

export default function WalletField({ asset, value, onChange, disabled }) {
  const meta = getAsset(asset);
  const check = validateAddress(asset, value);

  return (
    <div className="field">
      <label htmlFor="wallet" className="field-label">
        Wallet address
      </label>
      <input
        id="wallet"
        className={`mono wallet-input tone-${check.tone}`}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={meta.placeholder}
        required
        disabled={disabled}
        autoComplete="off"
        spellCheck="false"
        aria-describedby="wallet-hint"
      />
      <p id="wallet-hint" className={`hint tone-${check.tone}`}>
        {check.message}
      </p>
    </div>
  );
}
