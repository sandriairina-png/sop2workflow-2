'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { Section } from '@/shared/types/blocks/landing';

export function Faq({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={`linearity-subtle-field bg-[#050507] py-24 text-[#f8f6f3] md:py-36 ${className}`}
    >
      <div className="mx-auto grid max-w-[1400px] gap-12 px-5 md:px-8 lg:grid-cols-[.7fr_1.3fr] xl:px-12">
        <ScrollAnimation>
          <div>
            <span className="text-[10px] tracking-[0.08em] text-[#a99cff]">
              {section.label}
            </span>
            <h2 className="mt-5 mb-5 text-2xl font-medium tracking-[-0.035em] md:text-4xl">
              {section.title}
            </h2>
            <p className="max-w-md text-sm leading-7 text-white/42">
              {section.description}
            </p>
          </div>
        </ScrollAnimation>

        <ScrollAnimation delay={0.2}>
          <div className="mx-auto max-w-full">
            <Accordion
              type="single"
              collapsible
              className="w-full overflow-hidden rounded-[28px] border border-white/[0.1] bg-white/[0.025] px-5 md:px-8"
            >
              {section.items?.map((item, idx) => (
                <div className="group" key={idx}>
                  <AccordionItem
                    value={item.question || item.title || ''}
                    className="peer border-b border-white/[0.08] px-1 py-2 last:border-b-0"
                  >
                    <AccordionTrigger className="cursor-pointer py-5 text-left text-sm font-medium hover:no-underline">
                      {item.question || item.title || ''}
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="max-w-2xl pb-4 text-xs leading-6 text-white/42">
                        {item.answer || item.description || ''}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </div>
              ))}
            </Accordion>

            <p
              className="text-muted-foreground mt-6 px-8"
              dangerouslySetInnerHTML={{ __html: section.tip || '' }}
            />
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
