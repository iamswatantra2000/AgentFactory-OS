'use client';
import { useState } from 'react';
import Image from 'next/image';
import oliveBranch from '@/public/images/brand/component7.png';
import { CheckCircleIcon, ArrowRightIcon, EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { Button, Card, TextField } from '@/components/design-system';
import { AccessAction } from './AccessAction';
import styles from './complete.module.css';

const plans = [
  {
    name: 'Starter',
    price: '$29',
    description: 'A focused beginning for solo founders.',
    features: [
      'Company structure planning',
      'Role and responsibility definitions',
      'Workflow design foundation',
    ],
    note: 'For your first company blueprint.',
  },
  {
    name: 'Team',
    price: '$79',
    description: 'A shared direction for a growing team.',
    features: [
      'Everything proposed in Starter',
      'Shared context planning',
      'Human approval checkpoints',
    ],
    note: 'For work that crosses responsibilities.',
  },
  {
    name: 'Business',
    price: 'Custom',
    description: 'A considered fit for complex operations.',
    features: [
      'Everything proposed in Team',
      'Organization-wide workflow planning',
      'Requirements-led workspace design',
    ],
    note: 'Scope and pricing to be confirmed.',
  },
];
export function PricingSection({ authenticated = false }: { authenticated?: boolean }) {
  return (
    <section id="pricing" className={styles.pricing} aria-labelledby="pricing-heading">
      <div className={styles.pricingHeader} data-motion-reveal data-motion-copy>
        <div>
          <p className={styles.eyebrow}>Simple plans. Clear expectations.</p>
          <h2 id="pricing-heading">
            A plan for every
            <br />
            accountable team.
          </h2>
        </div>
        <p>Start with the structure you need. Build toward the company you want to become.</p>
      </div>
      <p id="pricing-note" className={styles.previewNote}>
        Proposed pricing · USD · Monthly per workspace. These are design placeholders, not
        purchasable offers. Features and final prices are subject to confirmation.
      </p>
      <div className={styles.plans} data-motion-reveal data-motion-group>
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={`${styles.plan} ${plan.name === 'Team' ? styles.featured : ''}`}
          >
            <p className={styles.planLabel}>
              {plan.name === 'Team'
                ? 'For growing teams'
                : plan.name === 'Starter'
                  ? 'For a focused start'
                  : 'For broader ambitions'}
            </p>
            <h3>{plan.name}</h3>
            <p className={styles.planDescription}>{plan.description}</p>
            <div className={styles.price}>
              {plan.price}
              {plan.price !== 'Custom' && <span>/ month</span>}
            </div>
            <p className={styles.priceNote}>Proposed plan · not yet available</p>
            <AccessAction arrow authenticated={authenticated} />
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <CheckCircleIcon size={18} weight="fill" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <p className={styles.planFoot}>{plan.note}</p>
          </article>
        ))}
      </div>
      <p className={styles.pricingFoot}>
        Paid workspace access is planned. This preview does not collect payments or activate
        subscriptions.
      </p>
    </section>
  );
}

export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  return (
    <section id="newsletter" className={styles.newsletter} aria-labelledby="newsletter-heading">
      <Image
        src={oliveBranch}
        alt=""
        aria-hidden="true"
        className={styles.newsletterArt}
        data-motion-parallax
        sizes="320px"
      />
      <div data-motion-reveal data-motion-copy>
        <p className={styles.eyebrow}>A thoughtful update, not another distraction</p>
        <h2 id="newsletter-heading">
          Follow the work
          <br />
          behind the workspace.
        </h2>
        <p>
          Product milestones, practical ideas for designing your AI-enabled company, and a first
          look at what comes next.
        </p>
        <ul className={styles.newsletterTopics} aria-label="Newsletter topics">
          <li>
            <CheckCircleIcon size={18} aria-hidden="true" /> Product notes
          </li>
          <li>
            <CheckCircleIcon size={18} aria-hidden="true" /> Practical workflows
          </li>
          <li>
            <CheckCircleIcon size={18} aria-hidden="true" /> Thoughtful progress
          </li>
        </ul>
      </div>
      <Card raised className={styles.newsletterForm} data-motion-reveal>
        <div className={styles.newsletterCardHeader}>
          <span className={styles.mailIcon}>
            <EnvelopeSimpleIcon size={28} weight="light" aria-hidden="true" />
          </span>
          <span className={styles.editionLabel}>
            The field notes
            <br />
            <strong>AgentFactory OS</strong>
          </span>
        </div>
        <h3>Notes from AgentFactory OS</h3>
        <p>
          Newsletter signup is coming soon. You can preview the form below; your email won’t be
          stored or sent.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setMessage('Signup is not available yet. Your email has not been saved or subscribed.');
          }}
        >
          <TextField
            label="Email address"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setMessage('');
            }}
            placeholder="you@company.com"
          />
          <Button type="submit" size="large">
            Keep me updated <ArrowRightIcon size={18} aria-hidden="true" />
          </Button>
          <p className={styles.formStatus} role="status">
            {message}
          </p>
        </form>
        <small>
          No submission leaves this browser. A subscription service and consent policy will be added
          before launch.
        </small>
      </Card>
    </section>
  );
}
