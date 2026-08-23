import { AMOUNT_CHIPS, MAX_USD, MIN_USD } from '../lib/assets';

export default function AmountField({ value, onChange, disabled, showChips = false }) {
  const n = Number(value);
  const chipMatch = AMOUNT_CHIPS.includes(n);

  return (
    <div className="amount-block">
      <div className="amount-input">
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
          aria-label="Amount in USD"
        />
      </div>
      {showChips && (
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
        </div>
      )}
    </div>
  );
}
