'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { gsap as Gsap } from 'gsap';
import type { ScrollTrigger as ScrollTriggerInstance } from 'gsap/ScrollTrigger';
import { shouldReveal } from './motion-policy';

type RevealState = {
  items: HTMLElement[];
  trigger?: ScrollTriggerInstance;
  tween?: ReturnType<typeof Gsap.to>;
  revealed: boolean;
};

/** Scroll motion enhances the server HTML without making content depend on JavaScript. */
export function LandingMotion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let media: ReturnType<typeof Gsap.matchMedia> | undefined;

    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (disposed || !root.current) return;

        gsap.registerPlugin(ScrollTrigger);
        const scope = root.current;
        media = gsap.matchMedia();
        media.add(
          {
            motion: '(prefers-reduced-motion: no-preference)',
            mobile: '(max-width: 767px)',
            desktop: '(min-width: 768px)',
          },
          (context) => {
            if (!context.conditions?.motion) return;
            const states = new Map<HTMLElement, RevealState>();
            const compact = Boolean(context.conditions.mobile);

            // Delayed trigger callbacks are registered with the GSAP context so they
            // revert when the motion preference changes or this screen unmounts.
            context.add('reveal', (target: HTMLElement, immediate = false) => {
              const state = states.get(target);
              if (!state || state.revealed) {
                if (immediate && state?.tween) state.tween.progress(1);
                return;
              }

              state.revealed = true;
              state.trigger?.kill();
              state.tween = gsap.to(state.items, {
                y: 0,
                scale: 1,
                opacity: 1,
                duration: immediate ? 0 : compact ? 0.62 : 0.82,
                stagger: immediate ? 0 : compact ? 0.07 : 0.11,
                ease: 'power3.out',
                overwrite: 'auto',
                onComplete: () =>
                  gsap.set(state.items, { clearProps: 'transform,opacity,willChange' }),
              });
            });

            scope.querySelectorAll<HTMLElement>('[data-motion-reveal]').forEach((target) => {
              // Already-visible content and deep-link destinations stay visible.
              if (!shouldReveal(target.getBoundingClientRect().top, window.innerHeight)) return;

              const sequenced =
                target.hasAttribute('data-motion-group') || target.hasAttribute('data-motion-copy');
              const items = sequenced
                ? Array.from(target.children).filter(
                    (child): child is HTMLElement =>
                      child instanceof HTMLElement && child.getAttribute('aria-hidden') !== 'true',
                  )
                : [target];
              if (items.length === 0) return;

              gsap.set(items, {
                y: compact ? 16 : 28,
                scale: target.hasAttribute('data-motion-group') ? 0.985 : 1,
                opacity: 0,
                willChange: 'transform,opacity',
              });

              const state: RevealState = { items, revealed: false };
              states.set(target, state);
              state.trigger = ScrollTrigger.create({
                trigger: target,
                start: 'top 88%',
                once: true,
                onEnter: () => context.reveal(target),
              });
            });

            // Only decoration scrubs with scroll; reading and controls never do.
            if (!compact) {
              scope.querySelectorAll<HTMLElement>('[data-motion-parallax]').forEach((art) => {
                const section = art.closest('section');
                if (!section) return;
                gsap.fromTo(
                  art,
                  { y: -16 },
                  {
                    y: 16,
                    ease: 'none',
                    scrollTrigger: {
                      trigger: section,
                      start: 'top bottom',
                      end: 'bottom top',
                      scrub: 0.6,
                    },
                  },
                );
              });
            }

            const finishFocused = (event: FocusEvent) => {
              for (const [target, state] of states) {
                if (target.contains(event.target as Node)) {
                  if (state.revealed) state.tween?.progress(1);
                  else context.reveal(target, true);
                }
              }
            };
            scope.addEventListener('focusin', finishFocused);

            return () => {
              scope.removeEventListener('focusin', finishFocused);
              for (const state of states.values()) {
                state.trigger?.kill();
                state.tween?.kill();
                gsap.set(state.items, { clearProps: 'transform,opacity,willChange' });
              }
              states.clear();
            };
          },
          scope,
        );
      })
      .catch(() => {
        // Optional motion must never prevent reading, navigation, or form use.
      });
    return () => {
      disposed = true;
      media?.revert();
    };
  }, []);
  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
