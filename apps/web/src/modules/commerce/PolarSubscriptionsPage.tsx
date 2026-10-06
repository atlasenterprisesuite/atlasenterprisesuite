import { Link, useSearchParams } from 'react-router-dom';
import './commerce.css';
import './subscriptions.css';

type ReturnState = 'ready' | 'pending_verification' | 'canceled';

function resolveState(status: string | null): ReturnState {
  if (status === 'success') return 'pending_verification';
  if (status === 'canceled') return 'canceled';
  return 'ready';
}

const copy: Record<ReturnState, { eyebrow: string; title: string; description: string }> = {
  ready: {
    eyebrow: 'ATLAS Commerce · Subscriptions',
    title: 'Subscribe to ATLAS through Polar',
    description: 'Continue to the provider-hosted checkout. Polar processes the payment details; ATLAS does not collect card numbers on this page.'
  },
  pending_verification: {
    eyebrow: 'ATLAS Commerce · Provider return',
    title: 'Payment verification pending',
    description: 'The browser returned from Polar, but ATLAS has not marked the subscription active. Access remains unchanged until a signed provider event is verified server-side.'
  },
  canceled: {
    eyebrow: 'ATLAS Commerce · Provider return',
    title: 'Checkout canceled',
    description: 'No subscription was recorded by ATLAS. You can return to the hosted checkout whenever you are ready.'
  }
};

export function PolarSubscriptionsPage() {
  const [searchParams] = useSearchParams();
  const state = resolveState(searchParams.get('status'));
  const content = copy[state];

  return (
    <section className="commerce-page subscriptions-page page-stack">
      <header className="subscriptions-hero">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </header>
      <section className="commerce-panel subscriptions-provider-card" aria-labelledby="polar-provider-title">
        <div>
          <span className="eyebrow">Hosted checkout provider</span>
          <h2 id="polar-provider-title">Polar</h2>
          <p>Secure external checkout for the ATLAS offer configured by the account owner.</p>
        </div>
        <dl className="payment-provider-facts">
          <div><dt>Checkout</dt><dd>Provider hosted</dd></div>
          <div><dt>Card data in ATLAS</dt><dd>Not collected</dd></div>
          <div><dt>Activation</dt><dd>Signed event required</dd></div>
        </dl>
        <div className="notice strong">
          Trust boundary: opening or returning from checkout is not proof of payment. ATLAS only recognizes paid access after authenticated provider verification is configured and succeeds.
        </div>
        {state !== 'pending_verification' ? (
          <a className="commerce-provider-link subscriptions-primary-action" href="/checkout/polar">Continue to secure Polar checkout</a>
        ) : (
          <Link className="commerce-provider-link" to="/identity">Continue to ATLAS Identity</Link>
        )}
      </section>
      <Link className="text-link" to="/">Return to ATLAS</Link>
    </section>
  );
}

export const polarSubscriptionsInternals = { resolveState };
