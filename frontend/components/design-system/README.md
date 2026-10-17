# AgentFactory OS design system

Reusable frontend primitives from the Measured Intelligence design specification.
Preview at `/design-system`. Global styles and Google fonts are loaded by `app/layout.tsx`.

```tsx
import { Button, TextField, Card, CardBody, StatusChip } from '@/components/design-system';

<Card>
  <CardBody>
    <h2 className="af-heading-3">Create an agent</h2>
    <TextField label="Agent name" name="name" required />
    <StatusChip tone="active">Active</StatusChip>
    <Button type="submit" size="large">
      Create agent
    </Button>
  </CardBody>
</Card>;
```

## Files and API

- `tokens.css`: source palette, typography, spacing, radii, elevation, motion and responsive grid variables.
- `components.css`: states and styles for shared controls, cards and tables.
- `patterns.css`: loading overlays, public/auth shells, compatibility aliases and gallery layout.
- `index.tsx`: Button, TextField, SelectField, Checkbox, Radio, Toggle, StatusChip, FeedbackBanner, Card, CardBody, CardFooter, Avatar, BrandWordmark, PublicShell, AuthShell and generic DataTable.

Buttons support primary, secondary, tertiary, destructive and destructive-outline variants;
small (32px), medium (40px) and large (48px) sizes. Tertiary is an inline text action.
Set `loading` and a short `loadingLabel` to disable repeated actions without changing width.
Fields accept native input props plus `label`, `helperText` and `error`. Password fields include
a visibility control. Checkbox/radio/toggle accept native controlled or uncontrolled props.
Use a shared `name` for each radio group and a fieldset/legend around related choices.

DataTable accepts typed columns with `heading`, `key` and `render(row)`, rows and a stable
`rowKey`. It preserves all columns in a keyboard-scrollable region on small screens;
the product-specific priority-column/detail-drawer pattern is not implemented here.

## Fidelity and boundaries

The written spec takes precedence over screenshot colors affected by lighting/texture.
DM Serif Display 400 and Inter are loaded using Next's Google-font integration.
Source token hex values and typography sizes are preserved. `sage-200`, blue information
colors and several derived hover/tint values are supplemental choices, not source tokens.
Phosphor outline icons are the closest installed library; their stroke geometry is not
an exact universal 1.5px match. The decorative olive/paper board artwork is not part of
these reusable controls and has not been approximated with CSS artwork.

This is a component library, not finished product screens or backend integration.
PublicShell and AuthShell are layout primitives. App-shell drawer/navigation, confirmation
dialogs and route-specific CTA wiring remain screen-level work. Do not use a destructive
button as a substitute for confirmation. Existing application screens are not rewritten.

## Validation

Run `pnpm check` with the repository's Node 24 runtime. The current test command allows no
tests; a successful command does not imply automated component test coverage. The gallery
is available for browser checks and future visual regression tests.
