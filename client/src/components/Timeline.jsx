const STEPS = [
  { key: 'paid', label: 'Paid', wait: 'Waiting for Stripe confirmation' },
  { key: 'quoted', label: 'Quoted', wait: 'Conversion sized at live rate' },
  { key: 'broadcasting', label: 'Broadcasting', wait: 'Submitting the mainnet transfer' },
  { key: 'confirmed', label: 'Confirmed', wait: 'Waiting for the explorer link' },
];

export function timelineState(order) {
  if (!order) {
    return { paid: 'wait', quoted: 'wait', broadcasting: 'wait', confirmed: 'wait' };
  }
  const { status } = order;
  if (status === 'failed') {
    return { paid: 'done', quoted: 'done', broadcasting: 'fail', confirmed: 'wait' };
  }
  if (status === 'completed') {
    return { paid: 'done', quoted: 'done', broadcasting: 'done', confirmed: 'done' };
  }
  if (status === 'processing') {
    return { paid: 'done', quoted: 'done', broadcasting: 'active', confirmed: 'wait' };
  }
  // pending
  return { paid: 'active', quoted: 'done', broadcasting: 'wait', confirmed: 'wait' };
}

export default function Timeline({ order }) {
  const state = timelineState(order);

  return (
    <ol className="timeline">
      {STEPS.map((step, i) => {
        const st = state[step.key];
        return (
          <li key={step.key} className={`tl-step is-${st}`}>
            {i < STEPS.length - 1 && <span className="tl-rail" aria-hidden="true" />}
            <span className="tl-dot" aria-hidden="true" />
            <div>
              <strong>{step.label}</strong>
              <p>
                {st === 'done' && step.key === 'paid' && 'Card payment received'}
                {st === 'done' && step.key === 'quoted' && order
                  ? `${order.crypto_amount} ${order.asset} reserved at quote`
                  : null}
                {st === 'done' && step.key === 'broadcasting' && 'Transfer submitted to mainnet'}
                {st === 'done' && step.key === 'confirmed' && 'On-chain delivery complete'}
                {st === 'active' && step.wait}
                {st === 'wait' && step.wait}
                {st === 'fail' && 'Broadcast failed. Contact support with this order ID.'}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
