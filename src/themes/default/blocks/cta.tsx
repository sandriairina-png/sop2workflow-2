'use client';

import { Link } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import Aurora from '@/shared/components/ui/aurora';
import { Button } from '@/shared/components/ui/button';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function Cta({
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
        'linearity-closing-cta overflow-hidden bg-[#050507] py-24 text-[#f8f6f3] md:py-36',
        section.className,
        className
      )}
    >
      <div className="mx-auto max-w-[1680px] px-5 md:px-10 xl:px-14">
        <div className="relative overflow-hidden rounded-[34px] border border-white/[0.12] bg-[#111219] px-6 py-20 text-center shadow-[0_50px_160px_rgba(0,0,0,.55)] md:py-32">
          <div className="linearity-cta-aurora" aria-hidden>
            <Aurora
              colorStops={['#5227FF', '#7cff67', '#5227FF']}
              amplitude={0.9}
              blend={0.68}
              height={0.58}
              speed={0.7}
              glow={0.62}
              brightness={1.12}
              layers={2}
              direction="bottom"
              opacity={0.92}
            />
          </div>
          <div className="linearity-grain" />
          <div className="relative z-10">
            <ScrollAnimation>
              <h2 className="mx-auto max-w-4xl text-3xl font-medium tracking-[-0.04em] text-balance lg:text-5xl">
                {section.title}
              </h2>
            </ScrollAnimation>
            <ScrollAnimation delay={0.15}>
              <p
                className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/45"
                dangerouslySetInnerHTML={{ __html: section.description ?? '' }}
              />
            </ScrollAnimation>

            <ScrollAnimation delay={0.3}>
              <div className="mt-12 flex flex-wrap justify-center gap-4">
                {section.buttons?.map((button, idx) => (
                  <Button
                    asChild
                    size={button.size || 'lg'}
                    variant={button.variant || 'secondary'}
                    className="rounded-full border border-white/35 bg-white px-7 text-[#090a0d] shadow-[0_14px_50px_rgba(82,39,255,.22)] hover:bg-white/90"
                    key={idx}
                  >
                    <Link
                      href={button.url || ''}
                      target={button.target || '_self'}
                    >
                      {button.icon && (
                        <SmartIcon name={button.icon as string} />
                      )}
                      <span>{button.title}</span>
                    </Link>
                  </Button>
                ))}
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </div>
    </section>
  );
}
