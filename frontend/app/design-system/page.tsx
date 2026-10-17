'use client';

import { useState } from 'react';
import {
  ArrowRightIcon,
  FileTextIcon,
  UsersIcon,
  HouseIcon,
  ShieldIcon,
  SlidersIcon,
} from '@phosphor-icons/react';
import {
  Button,
  TextField,
  SelectField,
  Checkbox,
  Radio,
  Toggle,
  StatusChip,
  FeedbackBanner,
  Card,
  CardBody,
  CardFooter,
  Avatar,
  BrandWordmark,
  DataTable,
} from '@/components/design-system';
import type { ButtonVariant, StatusTone } from '@/components/design-system';

const colors = [
  'Forest 900|#133D28',
  'Forest 800|#184D32',
  'Forest 700|#23623F',
  'Sage 100|#E6EEE3',
  'Canvas|#F7F4EC',
  'Surface|#FFFDF8',
  'Paper|#F1EBDF',
  'Ink|#121612',
  'Slate|#5D635E',
  'Border|#D8D2C5',
  'Clay|#A63E27',
  'Clay 100|#F8E3DA',
  'Amber|#9B651F',
  'Amber 100|#F4E8D2',
  'White|#FFFFFF',
];
const statuses: [StatusTone, string][] = [
  ['active', 'Active'],
  ['progress', 'In progress'],
  ['review', 'In review'],
  ['needs-review', 'Needs review'],
  ['completed', 'Completed'],
  ['paused', 'Paused'],
  ['failed', 'Failed'],
  ['locked', 'Locked'],
];
export default function DesignSystemPage() {
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  return (
    <main className="ds-showcase">
      <header className="ds-showcase-header">
        <BrandWordmark />
        <p className="af-eyebrow">Design system / Measured intelligence</p>
        <a href="/" className="ds-section-link">
          Back to application
        </a>
      </header>
      <section className="ds-intro">
        <p className="af-eyebrow">Foundations</p>
        <h1 className="af-heading-1">Calm systems. Clear accountability. Human judgment.</h1>
        <p className="af-body-large">Reusable foundations and controls for a more capable team.</p>
      </section>
      <div className="ds-grid">
        <section className="ds-panel ds-wide">
          <h2 className="af-heading-3">01. Color</h2>
          <p>Exact values from the Measured Intelligence specification.</p>
          <div className="ds-swatches">
            {colors.map((item) => {
              const [name, color] = item.split('|');
              return (
                <div key={name}>
                  <div className="ds-swatch" style={{ backgroundColor: color }} />
                  <div className="af-ui-label">{name}</div>
                  <code>{color}</code>
                </div>
              );
            })}
          </div>
        </section>
        <section className="ds-panel">
          <h2 className="af-heading-3">02. Typography</h2>
          <p>Playfair Display for editorial headings. Montserrat for the interface.</p>
          <div className="ds-stack">
            <div className="af-display-xl">Display XL</div>
            <div className="af-heading-1">Heading one</div>
            <div className="af-heading-2">Heading two</div>
            <div className="af-heading-3">Heading three</div>
            <div className="af-heading-4">Heading four</div>
            <div className="af-body-large">Body large · 18 / 28</div>
            <div className="af-body-medium">Body medium · 16 / 24</div>
            <div className="af-body-small">Body small · 14 / 20</div>
            <div className="af-eyebrow">Your agents, clearly accountable.</div>
          </div>
        </section>
        <section className="ds-panel">
          <h2 className="af-heading-3">03. Buttons</h2>
          <p>Primary, secondary, tertiary, and destructive actions.</p>
          {(
            [
              'primary',
              'secondary',
              'tertiary',
              'destructive',
              'destructive-outline',
            ] as ButtonVariant[]
          ).map((variant) => (
            <div className="ds-row" key={variant}>
              <Button variant={variant}>
                {variant === 'primary'
                  ? 'Get started'
                  : variant === 'secondary'
                    ? 'Explore workflow'
                    : variant === 'tertiary'
                      ? 'View details'
                      : 'Delete agent'}
                <ArrowRightIcon size={16} />
              </Button>
              <Button variant={variant} disabled>
                Unavailable
              </Button>
            </div>
          ))}
          <div className="ds-row">
            {(['large', 'medium', 'small'] as const).map((size) => (
              <Button key={size} size={size} variant="secondary">
                {size}
              </Button>
            ))}
          </div>
          <Button
            loading={loading}
            loadingLabel="Creating…"
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            Create an agent
            <ArrowRightIcon size={16} />
          </Button>
        </section>
        <section className="ds-panel ds-wide">
          <h2 className="af-heading-3">04. Form controls</h2>
          <p>Surface fill, 48px height, 4px radius, and inline guidance.</p>
          <div className="ds-fields">
            <TextField label="Email address" placeholder="name@company.com" type="email" />
            <TextField label="Work email" defaultValue="jordan@acme.co" />
            <TextField
              label="Invalid email"
              defaultValue="name@company"
              error="Enter a valid work email."
            />
            <TextField label="Password" type="password" defaultValue="password" />
            <SelectField label="Select a team" defaultValue="">
              <option value="">Select a team</option>
              <option value="growth">Growth team</option>
              <option value="operations">Operations team</option>
            </SelectField>
            <TextField
              label="Disabled field"
              disabled
              placeholder="name@company.com"
              helperText="Your administrator manages this field."
            />
          </div>
        </section>
        <section className="ds-panel">
          <h2 className="af-heading-3">05. Selection controls</h2>
          <div className="ds-row">
            <div className="ds-stack">
              <Checkbox label="Remember me" />
              <Checkbox label="Remember me" defaultChecked />
              <Checkbox label="Remember me" defaultChecked disabled />
            </div>
            <div className="ds-stack">
              <Radio label="Monthly" name="billing" />
              <Radio label="Annual" name="billing" defaultChecked />
              <Radio label="Unavailable" disabled />
            </div>
            <div className="ds-stack">
              <Toggle label="Email notifications" />
              <Toggle label="Email notifications" defaultChecked />
              <Toggle label="Email notifications" disabled />
            </div>
          </div>
          <h3 className="af-heading-4">Status</h3>
          <div className="ds-row">
            {statuses.map(([tone, label]) => (
              <StatusChip key={tone} tone={tone}>
                {label}
              </StatusChip>
            ))}
          </div>
        </section>
        <section className="ds-panel">
          <h2 className="af-heading-3">06. Feedback</h2>
          <p>Clear messages beside the action that needs attention.</p>
          <div className="ds-stack">
            {!dismissed && (
              <FeedbackBanner tone="success" title="Success" onDismiss={() => setDismissed(true)}>
                Agent created successfully.
              </FeedbackBanner>
            )}
            <FeedbackBanner tone="warning" title="Warning">
              Three items need your review.
            </FeedbackBanner>
            <FeedbackBanner tone="error" title="Error">
              Payment could not be completed.
            </FeedbackBanner>
            <FeedbackBanner tone="info" title="Information">
              Verification email sent.
            </FeedbackBanner>
          </div>
        </section>
        <section className="ds-panel">
          <h2 className="af-heading-3">07. Cards</h2>
          <p>Border-only surfaces with deliberate ownership and status.</p>
          <Card>
            <CardBody>
              <div className="af-card-title-row">
                <div className="af-card-meta">
                  <Avatar initials="DA" label="Data Analyst" />
                  <div>
                    <h3 className="af-card__title">Data Analyst</h3>
                    <p className="af-card__description">Customer insights and reporting</p>
                  </div>
                </div>
                <StatusChip tone="active">Active</StatusChip>
              </div>
            </CardBody>
            <CardFooter>
              <span className="af-inline-meta">
                <FileTextIcon size={20} />6 workflows
              </span>
              <span className="af-inline-meta">
                <UsersIcon size={20} />3 members
              </span>
            </CardFooter>
          </Card>
        </section>
        <section className="ds-panel">
          <h2 className="af-heading-3">08. Table</h2>
          <DataTable
            caption="Work ledger"
            rowKey={(row) => row.id}
            rows={[
              {
                id: 'brief',
                task: 'Prepare customer insights brief',
                owner: 'Data Analyst',
                context: 'Q4 enterprise customers',
                due: 'Today',
              },
            ]}
            columns={[
              { key: 'task', heading: 'Task', render: (row) => row.task },
              { key: 'owner', heading: 'Owner', render: (row) => row.owner },
              { key: 'context', heading: 'Context', render: (row) => row.context },
              {
                key: 'status',
                heading: 'Status',
                render: () => <StatusChip tone="progress">In progress</StatusChip>,
              },
              { key: 'due', heading: 'Due date', render: (row) => row.due },
            ]}
          />
        </section>
        <section className="ds-panel">
          <h2 className="af-heading-3">09. Spacing and icons</h2>
          <p>4px base unit. Rounded outline icons at 16, 20, and 24px.</p>
          <div className="ds-spacing">
            {[4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120].map((size) => (
              <div key={size}>
                <span style={{ height: size }} />
                <small>{size}</small>
              </div>
            ))}
          </div>
          <div className="ds-row">
            {[HouseIcon, UsersIcon, FileTextIcon, SlidersIcon, ShieldIcon].map((Icon, i) => (
              <Icon key={i} size={24} weight="light" />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
