import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOrder } from '../lib/api';

const UUID_HINT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function Lookup() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Find an order — Card to Crypto';
  }, []);
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const trimmed = id.trim();
  const formatOk = !trimmed || UUID_HINT.test(trimmed);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!UUID_HINT.test(trimmed)) {
      setError('Enter the full order ID from your success URL or receipt.');
      return;
    }
    setLoading(true);
    try {
      await fetchOrder(trimmed);
      navigate(`/success?order_id=${encodeURIComponent(trimmed)}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <section className="section status-page">
      <div className="wrap lookup-wrap">
        <div className="section-head">
          <p className="kicker">// Lookup</p>
          <h1>Find an order</h1>
          <p>
            Paste the order ID from the success page. We only read status — nothing is
            broadcast from here.
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
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              autoComplete="off"
              spellCheck="false"
              disabled={loading}
            />
            <p className={`hint${formatOk ? '' : ' tone-warn'}`}>
              {trimmed
                ? formatOk
                  ? 'Looks like an order ID.'
                  : 'That does not match the order ID format.'
                : 'UUID from /success?order_id='}
            </p>
          </div>
          <button type="submit" className="btn btn-primary" disabled={!trimmed || loading}>
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
