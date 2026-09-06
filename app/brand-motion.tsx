'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

/** Route-scoped motion; all content remains visible without JavaScript. */
export function BrandMotion({
  children,
  smooth = false,
}: {
  children: ReactNode;
  smooth?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        gsap.from('[data-enter]', {
          y: 30,
          opacity: 0,
          duration: 1,
          stagger: 0.12,
          ease: 'power3.out',
          clearProps: 'all',
        });
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
          gsap.from(element, {
            y: 32,
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out',
            clearProps: 'all',
            scrollTrigger: { trigger: element, start: 'top 94%', once: true },
          });
        });
      }, root);
      // Native touch scrolling and no smooth scrolling on authentication routes.
      const lenis =
        smooth && matchMedia('(pointer: fine)').matches
          ? new Lenis({ duration: 0.9, anchors: true, syncTouch: false })
          : null;
      const tick = (time: number) => lenis?.raf(time * 1000);
      if (lenis) {
        lenis.on('scroll', () => ScrollTrigger.update());
        gsap.ticker.add(tick);
      }
      return () => {
        gsap.ticker.remove(tick);
        lenis?.destroy();
        context.revert();
      };
    });
    return () => media.revert();
  }, [smooth]);
  return (
    <div ref={root} className="je-motion-root">
      {children}
    </div>
  );
}

