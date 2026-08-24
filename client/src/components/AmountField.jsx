import { AMOUNT_CHIPS, MAX_USD, MIN_USD } from '../lib/assets';

export default function AmountField({
  value,
  onChange,
  disabled,
  showChips = false,
  id = 'usd',
  ariaLabel = 'Amount in USD',
  min = MIN_USD,
  max = MAX_USD,
  step = '0.01',
}) {
  const n = Number(value);
  const chipMatch = AMOUNT_CHIPS.includes(n);

  return (
    <div className="amount-block">
      <div className="amount-input">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          disabled={disabled}
          aria-label={ariaLabel}
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
