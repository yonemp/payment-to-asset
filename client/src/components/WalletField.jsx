import { getAsset, validateAddress } from '../lib/assets';

export default function WalletField({
  asset,
  value,
  onChange,
  disabled,
  label,
  inputId = 'wallet',
}) {
  const meta = getAsset(asset);
  const check = validateAddress(asset, value);

  return (
    <div className="field">
      <label htmlFor={inputId} className="field-label">
        {label || 'Wallet address'}
      </label>
      <input
        id={inputId}
        className={`mono wallet-input tone-${check.tone}`}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={meta.placeholder}
        required
        disabled={disabled}
        autoComplete="off"
        spellCheck="false"
        aria-describedby={`${inputId}-hint`}
      />
      <p id={`${inputId}-hint`} className={`hint tone-${check.tone}`}>
        {check.message}
      </p>
    </div>
  );
}
