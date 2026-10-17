# Landing motion contract

- `LandingMotion` is a client enhancement around server-rendered content. GSAP is
  dynamically imported; content is never hidden in anticipation of animation loading.
- Explicit `data-motion-reveal` targets animate once when entering the viewport.
  `data-motion-group` staggers direct children. Do not nest reveal targets.
- Already-visible content and restored/deep-link positions are not animated again.
- Motion uses short transform/opacity tweens, not layout dimensions, scroll hijacking,
  autoplay loops, or pointer-following effects. Hover transforms are fine-pointer only.
- GSAP matchMedia reverts active animations when reduced motion is enabled. Unmount
  disconnects observers, removes focus listeners, and reverts the scoped context.
- Keyboard focus completes any active reveal immediately. Navigation, forms, and
  dialogs are independent of motion. Decoration has no accessibility-tree content.
- Entrance branding is decorative CSS with a 1.4-second finite lifetime; reduced-motion
  and keyboard users bypass it. Mobile navigation remains outside document flow.

## Release boundaries

This is a frontend product preview, not a production launch certification. Account,
payment and newsletter integrations, approved commercial copy, privacy/consent terms,
deployment headers/CSP, monitoring, and production performance/accessibility audits
must be completed before launch. Do not represent proposed pricing or newsletter
preview submission as a live subscription.

Run `pnpm check` for formatting, lint, TypeScript, tests, and production build.
Browser regression checks: mobile overlay without layout shift, Escape focus return,
anchor navigation, dialog focus, newsletter validation, reduced motion, and readable
content with JavaScript disabled or the animation chunk unavailable.
