'use client';

import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

import {
  NativeOpsSignalIcon,
  NativeOpsSystemMap,
} from './nativeops-brand-visuals';

export function Features({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={cn(
        'linearity-capability-strip linearity-subtle-field scroll-mt-24 bg-[#090a0d] py-24 text-[#f8f6f3] md:py-36',
        section.className,
        className
      )}
    >
      <div className="mx-auto grid max-w-[1680px] gap-16 px-5 md:px-10 lg:grid-cols-[minmax(0,.95fr)_minmax(440px,1.05fr)] lg:items-start xl:gap-24 xl:px-14">
        <ScrollAnimation>
          <div className="lg:sticky lg:top-28">
            <h2 className="max-w-2xl text-3xl font-medium tracking-[-0.04em] md:text-5xl">
              {section.title}
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/48 md:text-base">
              {section.description}
            </p>
            <NativeOpsSystemMap className="mt-10 w-full max-w-[760px]" />
          </div>
        </ScrollAnimation>

        <ScrollAnimation delay={0.16}>
          <div className="space-y-3">
            {section.items?.map((item, idx) => (
              <article
                className="group grid grid-cols-[52px_1fr] gap-4 rounded-2xl bg-white/[0.025] px-4 py-5 transition-colors hover:bg-white/[0.06] md:grid-cols-[64px_1fr] md:px-6 md:py-6"
                key={idx}
              >
                <NativeOpsSignalIcon
                  variant={idx}
                  className="size-11 text-white/72 transition-transform duration-300 group-hover:translate-x-1 md:size-12"
                />
                <div>
                  <h3 className="text-base font-medium text-white/92">
                    {item.title}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/46">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
