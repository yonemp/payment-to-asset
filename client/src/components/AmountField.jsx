import { AMOUNT_CHIPS, MAX_USD, MIN_USD } from '../lib/assets';

export default function AmountField({ value, onChange, disabled }) {
  const n = Number(value);
  const chipMatch = AMOUNT_CHIPS.includes(n);

  return (
    <div className="field">
      <label htmlFor="usd" className="field-label">
        Amount <span className="muted">USD</span>
      </label>
      <div className="chip-row" role="group" aria-label="Suggested amounts">
        {AMOUNT_CHIPS.map((amt) => (
          <button
            key={amt}
            type="button"
            className={`chip${chipMatch && n === amt ? ' selected' : ''}`}
            onClick={() => onChange(String(amt))}
            disabled={disabled}
          >
            ${amt}
          </button>
        ))}
        <button
          type="button"
          className={`chip${value && !chipMatch ? ' selected' : ''}`}
          onClick={() => {
            if (chipMatch || !value) onChange('');
            document.getElementById('usd')?.focus();
          }}
          disabled={disabled}
        >
          Custom
        </button>
      </div>
      <div className="amount-input">
        <span className="amount-prefix" aria-hidden="true">$</span>
        <input
          id="usd"
          type="number"
          min={MIN_USD}
          max={MAX_USD}
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          disabled={disabled}
        />
      </div>
      <p className="hint">
        {MIN_USD}–{MAX_USD.toLocaleString()} USD. 2% service fee is taken from this amount.
      </p>
    </div>
  );
}
