'use client';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

import {
  NativeOpsJourney,
  NativeOpsSignalIcon,
} from './nativeops-brand-visuals';

export function FeaturesStep({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const items = section.items || [];

  return (
    <section
      id={section.id}
      className={cn(
        'linearity-editorial linearity-subtle-field scroll-mt-24 overflow-hidden bg-[#050507] py-24 text-[#f8f6f3] md:py-32',
        section.className,
        className
      )}
    >
      <div className="mx-auto max-w-[1680px] px-5 md:px-10 xl:px-14">
        <ScrollAnimation>
          <div className="mx-auto mb-14 max-w-4xl text-center md:mb-20">
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-balance md:text-5xl">
              {section.title}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/48 md:text-base">
              {section.description}
            </p>
          </div>
        </ScrollAnimation>

        <ScrollAnimation delay={0.12}>
          <div className="relative mx-auto max-w-[1320px]">
            <NativeOpsJourney className="pointer-events-none absolute top-0 right-0 left-0 hidden h-[210px] w-full lg:block" />
            <ol className="scrollbar-hide grid snap-x snap-mandatory auto-cols-[minmax(250px,78vw)] grid-flow-col gap-3 overflow-x-auto pb-3 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-4 lg:gap-8 lg:overflow-visible lg:pt-24 lg:pb-0">
              {items.map((item, index) => (
                <li
                  key={item.id || item.title || index}
                  className="relative min-w-0 snap-start"
                >
                  <article className="group relative h-full min-h-56 rounded-2xl bg-[#0d0e12]/72 px-6 py-6 transition-colors hover:bg-[#15161c] lg:min-h-64 lg:bg-transparent lg:px-2 lg:pt-14">
                    <NativeOpsSignalIcon
                      variant={index}
                      className="mb-7 size-11 text-white/76 lg:hidden"
                    />
                    <h3 className="text-lg font-semibold tracking-[-0.025em] text-white/92">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-white/46">
                      {item.description}
                    </p>
                    <div className="mt-6 text-xs font-medium text-[#a9f59d]">
                      {item.tip}
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
