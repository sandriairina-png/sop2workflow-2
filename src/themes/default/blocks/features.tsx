'use client';

import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

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
        'linearity-capability-strip bg-[#090a0d] py-24 text-[#f8f6f3] md:py-36',
        section.className,
        className
      )}
    >
      <div className="mx-auto max-w-[1680px] space-y-14 px-5 md:px-10 xl:px-14">
        <ScrollAnimation>
          <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
            <span className="text-[10px] tracking-[0.08em] text-[#a99cff]">
              {section.label}
            </span>
            <div>
              <h2 className="mt-5 mb-5 text-3xl font-medium tracking-[-0.04em] md:text-5xl">
                {section.title}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-white/42">
                {section.description}
              </p>
            </div>
          </div>
        </ScrollAnimation>

        <ScrollAnimation delay={0.2}>
          <div className="relative mx-auto grid overflow-hidden rounded-[30px] border border-white/[0.1] bg-black/25 sm:grid-cols-2 lg:grid-cols-3">
            {section.items?.map((item, idx) => (
              <div
                className="group min-h-56 space-y-6 border-r border-b border-white/[0.07] p-7 transition-[background-color] duration-200 hover:bg-white/[0.045] md:p-9"
                key={idx}
              >
                <div className="flex items-center justify-between">
                  <div className="grid size-11 place-items-center rounded-full bg-white text-[#090a0d] transition-transform duration-200 group-hover:scale-105">
                    <SmartIcon name={item.icon as string} size={18} />
                  </div>
                  <span className="text-[9px] text-white/24">0{idx + 1}</span>
                </div>
                <h3 className="text-sm font-medium">{item.title}</h3>
                <p className="text-xs leading-6 text-white/38">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
