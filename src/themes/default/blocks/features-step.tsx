'use client';

import { Check } from 'lucide-react';

import { SmartIcon } from '@/shared/blocks/common';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

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
          <ol className="scrollbar-hide grid snap-x snap-mandatory auto-cols-[minmax(250px,78vw)] grid-flow-col gap-3 overflow-x-auto pb-3 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-4 lg:gap-0 lg:overflow-visible lg:pb-0">
            {items.map((item, index) => (
              <li
                key={item.id || item.title || index}
                className="relative min-w-0 snap-start px-1 lg:px-3"
              >
                {index < items.length - 1 ? (
                  <span
                    className="linearity-step-connector hidden lg:block"
                    aria-hidden="true"
                  />
                ) : null}
                <article className="relative h-full min-h-56 rounded-2xl border border-white/[0.1] bg-[#0d0e12]/84 px-6 py-6 transition-colors hover:border-white/20 hover:bg-[#121319]">
                  <div className="mb-7 flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-full border border-white/14 bg-white/[0.06] text-white">
                      {item.icon ? (
                        <SmartIcon name={item.icon as string} size={18} />
                      ) : (
                        <Check className="size-[18px]" />
                      )}
                    </span>
                    <span className="text-[11px] font-medium text-white/28 tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold tracking-[-0.025em] text-white/92">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/46">
                    {item.description}
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 text-xs text-white/62">
                    <Check className="size-3.5 text-[#7cff67]" />
                    {item.tip}
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </ScrollAnimation>
      </div>
    </section>
  );
}
