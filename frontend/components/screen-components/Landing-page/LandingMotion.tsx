'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { gsap as Gsap } from 'gsap';
import { shouldReveal } from './motion-policy';

/** Progressive enhancement: server HTML is never hidden while waiting for JS. */
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
    void import('gsap')
      .then(({ gsap }) => {
        if (disposed || !root.current || !('IntersectionObserver' in window)) return;
        const scope = root.current;
        media = gsap.matchMedia();
        media.add(
          '(prefers-reduced-motion: no-preference)',
          (context) => {
            const animations = new Map<Element, ReturnType<typeof gsap.to>>();
            // Context-owned callbacks ensure tweens created later by the observer are reverted.
            context.add('reveal', (target: HTMLElement) => {
              const items = target.hasAttribute('data-motion-group')
                ? Array.from(target.children)
                : [target];
              const tween = gsap.fromTo(
                items,
                { y: 18, opacity: 0.72 },
                {
                  y: 0,
                  opacity: 1,
                  duration: 0.55,
                  stagger: 0.07,
                  ease: 'power2.out',
                  clearProps: 'transform,opacity',
                },
              );
              animations.set(target, tween);
            });
            const observer = new IntersectionObserver(
              (entries) => {
                for (const entry of entries) {
                  if (!entry.isIntersecting) continue;
                  observer.unobserve(entry.target);
                  if (!entry.target.contains(document.activeElement)) context.reveal(entry.target);
                }
              },
              { threshold: 0.08 },
            );
            scope.querySelectorAll<HTMLElement>('[data-motion-reveal]').forEach((target) => {
              // Do not flash already-visible content, deep links, or restored scroll positions.
              if (shouldReveal(target.getBoundingClientRect().top, window.innerHeight))
                observer.observe(target);
            });
            const finishFocused = (event: FocusEvent) => {
              for (const [target, tween] of animations) {
                if (target.contains(event.target as Node)) tween.progress(1);
              }
            };
            scope.addEventListener('focusin', finishFocused);
            return () => {
              observer.disconnect();
              scope.removeEventListener('focusin', finishFocused);
              animations.clear();
            };
          },
          scope,
        );
      })
      .catch(() => {
        // A failed optional animation chunk must not interrupt navigation or reading.
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
