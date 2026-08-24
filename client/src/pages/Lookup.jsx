import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOrder } from '../lib/api';

const UUID_HINT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_HINT = /^cs_(live|test)_[A-Za-z0-9]+$/i;
const INTENT_HINT = /^pi_(live_|test_)?[A-Za-z0-9]+$/i;
const SHORT_HINT = /^[0-9a-f]{6,}[0-9a-f-]*(?:…|\.\.\.)[0-9a-f-]{4,}$/i;
const PREFIX_HINT = /^[0-9a-f]{8}(-[0-9a-f]{0,4}){0,4}[0-9a-f-]*$/i;

function classifyId(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { trimmed, kind: 'empty' };
  if (UUID_HINT.test(trimmed)) return { trimmed, kind: 'order' };
  if (SESSION_HINT.test(trimmed)) return { trimmed, kind: 'session' };
  if (INTENT_HINT.test(trimmed)) return { trimmed, kind: 'intent' };
  if (SHORT_HINT.test(trimmed)) return { trimmed, kind: 'short' };
  if (PREFIX_HINT.test(trimmed) && trimmed.length >= 8 && trimmed.length < 36) {
    return { trimmed, kind: 'prefix' };
  }
  return { trimmed, kind: 'unknown' };
}

export default function Lookup() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'No KYC Card to Crypto';
  }, []);
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const parsed = classifyId(id);
  const formatOk = parsed.kind !== 'unknown';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (parsed.kind === 'empty') {
      setError('Enter the full order ID, a shortened order ID, or a Stripe cs_ / pi_ id.');
      return;
    }
    if (parsed.kind === 'unknown') {
      setError('Use a full order ID, a shortened order ID from the success page, or a Stripe cs_ / pi_ id.');
      return;
    }
    setLoading(true);
    try {
      const order = await fetchOrder(parsed.trimmed);
      const dest = order && order.id ? order.id : parsed.trimmed;
      navigate(`/success?order_id=${encodeURIComponent(dest)}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  const hint =
    parsed.kind === 'order'
      ? 'Looks like an order ID.'
      : parsed.kind === 'session'
        ? 'Looks like a Stripe checkout session id.'
        : parsed.kind === 'intent'
          ? 'Looks like a Stripe payment id from the receipt.'
          : parsed.kind === 'short' || parsed.kind === 'prefix'
            ? 'Looks like a shortened order ID — we will match it if it is unique.'
            : parsed.kind === 'unknown'
              ? 'Use a UUID, a shortened order ID, or a Stripe cs_ / pi_ id.'
              : 'Full order ID from the success page, or a Stripe cs_ / pi_ id';

  return (
    <section className="section status-page">
      <div className="wrap lookup-wrap">
        <div className="section-head">
          <p className="kicker">// Lookup</p>
          <h1>Find an order</h1>
          <p>
            Paste the full order ID from the success page. A Stripe checkout session
            id or payment id from the receipt also works.
          </p>
        </div>

        <form className="ticket" onSubmit={handleSubmit}>
          {error && (
            <div className="banner error" role="alert">
              {error}
            </div>
          )}
          <div className="field">
            <label htmlFor="order-id" className="field-label">
              Order ID
            </label>
            <input
              id="order-id"
              className="mono"
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="order UUID, cs_live_…, or pi_…"
              autoComplete="off"
              spellCheck="false"
              disabled={loading}
            />
            <p className={`hint${formatOk ? '' : ' tone-warn'}`}>{hint}</p>
          </div>
          <button type="submit" className="btn btn-primary" disabled={!parsed.trimmed || loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Looking up…
              </>
            ) : (
              'Open status'
            )}
          </button>
        </form>
      </div>
    </section>
  );
}
