'use client';

import { ArrowRight, Check, Workflow } from 'lucide-react';

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
  return (
    <section
      id={section.id}
      className={cn(
        'linearity-editorial overflow-hidden bg-[#050507] py-24 text-[#f8f6f3] md:py-40',
        section.className,
        className
      )}
    >
      <div className="mx-auto max-w-[1680px] px-5 md:px-10 xl:px-14">
        <ScrollAnimation>
          <div className="mx-auto mb-20 max-w-5xl text-center md:mb-32">
            <span className="text-[11px] tracking-[0.08em] text-[#a99cff]">
              {section.label}
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.045em] text-balance md:text-6xl">
              {section.title}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/42 md:text-base">
              {section.description}
            </p>
          </div>
        </ScrollAnimation>

        <div className="space-y-16 md:space-y-28">
          {section.items?.map((item, idx) => (
            <ScrollAnimation key={idx} delay={0.08}>
              <article className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
                <div className={cn('max-w-xl', idx % 2 === 1 && 'lg:order-2')}>
                  <div className="mb-8 flex items-center gap-3 text-[10px] tracking-[0.14em] text-white/32 uppercase">
                    <span className="grid size-9 place-items-center rounded-full bg-white text-[#090a0d]">
                      0{idx + 1}
                    </span>
                    SOP → WORKFLOW
                  </div>
                  <h3 className="text-2xl font-semibold tracking-[-0.035em] md:text-4xl">
                    {item.title}
                  </h3>
                  <p className="mt-5 max-w-lg text-sm leading-7 text-white/43 md:text-base">
                    {item.description}
                  </p>
                  <div className="mt-8 inline-flex items-center gap-2 text-xs text-white/70">
                    <Check className="size-4 text-[#7cff67]" />
                    {item.tip}
                  </div>
                </div>

                <div
                  className={cn(
                    'linearity-editorial-canvas relative min-h-[390px] overflow-hidden rounded-[30px] border border-white/10 p-5 md:min-h-[520px] md:p-8',
                    idx % 2 === 1 && 'lg:order-1'
                  )}
                >
                  <div className="absolute inset-0 bg-[#0d0e12]" />
                  <div className="relative flex h-full min-h-[350px] flex-col rounded-[22px] border border-white/[0.09] bg-black/35 p-5 shadow-2xl backdrop-blur-xl md:min-h-[456px] md:p-7">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                      <div className="flex items-center gap-2 text-xs text-white/65">
                        {item.icon ? (
                          <SmartIcon name={item.icon as string} size={16} />
                        ) : (
                          <Workflow className="size-4" />
                        )}
                        {item.title}
                      </div>
                      <span className="size-2 rounded-full bg-[#7cff67]" />
                    </div>
                    <div className="flex flex-1 items-center justify-center">
                      {idx === 0 ? (
                        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm leading-7 text-white/48">
                          <span className="text-white">“</span>
                          {item.description}
                          <span className="text-white">”</span>
                          <div className="mt-5 h-1.5 w-2/3 rounded-full bg-white/45" />
                        </div>
                      ) : (
                        <div className="flex w-full max-w-md flex-col items-center">
                          {[0, 1, 2].map((node) => (
                            <div
                              key={node}
                              className="flex w-full flex-col items-center"
                            >
                              <div className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#090a0d]">
                                  {node + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="h-2 w-1/2 rounded-full bg-white/35" />
                                  <div className="mt-2 h-1.5 w-4/5 rounded-full bg-white/10" />
                                </div>
                                {node === 2 ? (
                                  <ArrowRight className="size-4 text-[#7cff67]" />
                                ) : null}
                              </div>
                              {node < 2 ? (
                                <span className="h-8 w-px bg-white/16" />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            </ScrollAnimation>
          ))}
        </div>
      </div>
    </section>
  );
}
