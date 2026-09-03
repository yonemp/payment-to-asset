const BUY_STEPS = [
  { key: 'paid', label: 'Paid', wait: 'Waiting for card confirmation' },
  { key: 'quoted', label: 'Quoted', wait: 'Conversion sized at live rate' },
  { key: 'broadcasting', label: 'Broadcasting', wait: 'Submitting the transfer' },
  { key: 'confirmed', label: 'Confirmed', wait: 'Waiting for the explorer link' },
];

const CREDITS_STEPS = [
  { key: 'paid', label: 'Paid', wait: 'Waiting for card confirmation' },
  { key: 'credited', label: 'Credits issued', wait: 'Balance is issued after the card confirms' },
  { key: 'redeem', label: 'Redeem', wait: 'Redeem credits at insider.quest' },
];

const SWAP_STEPS = [
  { key: 'deposit', label: 'Deposit', wait: 'Send the from-asset to the deposit address' },
  { key: 'quoted', label: 'Quoted', wait: 'Conversion sized at live rate' },
  { key: 'settling', label: 'Settling', wait: 'Waiting for the deposit, then we send the to-asset' },
  { key: 'delivered', label: 'Delivered', wait: 'Waiting for the outbound transfer' },
];

export function timelineState(order) {
  const kind = order && (order.kind === 'swap' ? 'swap' : (order.kind === 'credits' || order.product === 'credits' || order.asset === 'CREDITS' ? 'credits' : 'buy'));
  if (kind === 'credits') {
    if (!order) {
      return { paid: 'wait', credited: 'wait', redeem: 'wait' };
    }
    const { status } = order;
    if (status === 'failed') {
      return { paid: 'done', credited: 'fail', redeem: 'wait' };
    }
    if (status === 'completed') {
      return { paid: 'done', credited: 'done', redeem: 'wait' };
    }
    if (status === 'processing') {
      return { paid: 'done', credited: 'active', redeem: 'wait' };
    }
    return { paid: 'active', credited: 'wait', redeem: 'wait' };
  }
  if (kind === 'swap') {
    if (!order) {
      return { deposit: 'wait', quoted: 'wait', settling: 'wait', delivered: 'wait' };
    }
    const { status } = order;
    if (status === 'failed') {
      return { deposit: 'done', quoted: 'done', settling: 'fail', delivered: 'wait' };
    }
    if (status === 'completed') {
      return { deposit: 'done', quoted: 'done', settling: 'done', delivered: 'done' };
    }
    if (status === 'processing' || order.deposit_tx) {
      return { deposit: 'done', quoted: 'done', settling: 'active', delivered: 'wait' };
    }
    return { deposit: 'active', quoted: 'done', settling: 'wait', delivered: 'wait' };
  }
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
  return { paid: 'active', quoted: 'done', broadcasting: 'wait', confirmed: 'wait' };
}

export default function Timeline({ order }) {
  const kind = order && (order.kind === 'swap' ? 'swap' : (order.kind === 'credits' || order.product === 'credits' || order.asset === 'CREDITS' ? 'credits' : 'buy'));
  const steps = kind === 'swap' ? SWAP_STEPS : kind === 'credits' ? CREDITS_STEPS : BUY_STEPS;
  const state = timelineState(order);

  return (
    <ol className="timeline">
      {steps.map((step, i) => {
        const st = state[step.key];
        return (
          <li key={step.key} className={`tl-step is-${st}`}>
            {i < steps.length - 1 && <span className="tl-rail" aria-hidden="true" />}
            <span className="tl-dot" aria-hidden="true" />
            <div>
              <strong>{step.label}</strong>
              <p>
                {st === 'done' && step.key === 'paid' && 'Card payment received'}
                {st === 'done' && step.key === 'credited' && (order && order.credits_amount != null
                  ? `${order.credits_amount} credits on this order`
                  : 'Credit balance issued')}
                {st === 'done' && step.key === 'deposit' && (order && order.deposit_address
                  ? `Send ${order.from_amount} ${order.from_asset} to the deposit address`
                  : 'Deposit address was not configured')}
                {st === 'done' && step.key === 'quoted' && order
                  ? kind === 'swap'
                    ? `${order.from_amount} ${order.from_asset} → ${order.crypto_amount} ${order.to_asset || order.asset}`
                    : `${order.crypto_amount} ${order.asset} reserved at quote`
                  : null}
                {st === 'done' && step.key === 'broadcasting' && 'Transfer submitted'}
                {st === 'done' && step.key === 'settling' && 'Deposit seen; outbound transfer submitted'}
                {st === 'done' && step.key === 'confirmed' && 'On-chain delivery complete'}
                {st === 'done' && step.key === 'delivered' && 'On-chain delivery complete'}
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
