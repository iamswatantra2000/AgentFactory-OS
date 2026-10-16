import Link from 'next/link';
import { BrandMark } from '@/components/ui';

export default function MarketingHome() {
  return (
    <div className="af-shell">
      <header className="af-nav">
        <BrandMark />
        <Link href="/workspace">Open workspace</Link>
      </header>
      <main className="af-hero">
        <section>
          <p className="af-kicker">Product foundation</p>
          <h1>Your idea deserves an entire company.</h1>
          <p className="af-lede">
            Design roles, responsibilities and the flow of work from one visual workspace. This
            foundation does not perform real AI-agent execution.
          </p>
        </section>
        <section className="af-blueprint" aria-label="Example organization blueprint">
          <p className="af-kicker">Organization preview</p>
          <div className="af-node">
            <strong>Founder</strong>
            <br />
            <span className="af-muted">Accountable authority</span>
          </div>
          <div className="af-node">
            <strong>Research lead</strong>
            <br />
            <span className="af-muted">Sample role</span>
          </div>
          <div className="af-node">
            <strong>Operations lead</strong>
            <br />
            <span className="af-muted">Sample role</span>
          </div>
        </section>
      </main>
    </div>
  );
}
