# Landing motion contract

- `LandingMotion` is a client enhancement around server-rendered content. GSAP is
  dynamically imported; content is never hidden in anticipation of animation loading.
- Explicit `data-motion-reveal` targets animate once as they enter the lower 88% of
  the viewport. `data-motion-copy` sequences direct editorial children; `data-motion-group`
  staggers direct cards or steps. Do not nest reveal targets.
- Below-fold targets are prepared only after GSAP and ScrollTrigger load. Already-visible
  content, deep links, and restored positions remain visible. A failed animation chunk
  leaves the original server-rendered HTML intact.
- Desktop-only `data-motion-parallax` shifts decorative artwork by 32px across its
  section. No content, form control, or navigation is tied to scroll progress.
- Motion uses short transform/opacity tweens, not layout dimensions, scroll hijacking,
  autoplay loops, or pointer-following effects. Mobile reveals are shorter and tighter;
  hover transforms remain fine-pointer only.
- GSAP matchMedia reconfigures motion across the mobile breakpoint and reverts it
  when reduced motion is enabled. Unmount kills scroll triggers, removes focus
  listeners, and reverts the scoped context.
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
