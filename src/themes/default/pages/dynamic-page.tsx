import { getThemeBlock } from '@/core/theme';
import AnimatedContent from '@/shared/components/ui/animated-content';
import type { DynamicPage as DynamicPageType } from '@/shared/types/blocks/landing';

export default async function DynamicPage({
  locale,
  page,
  data,
}: {
  locale?: string;
  page: DynamicPageType;
  data?: Record<string, any>;
}) {
  return (
    <>
      {page.title && !page.sections?.hero && (
        <h1 className="sr-only">{page.title}</h1>
      )}
      {page?.sections &&
        Object.keys(page.sections).map(async (sectionKey: string) => {
          const section = page.sections?.[sectionKey];
          if (!section || section.disabled === true) {
            return null;
          }

          if (page.show_sections && !page.show_sections.includes(sectionKey)) {
            return null;
          }

          // block name
          const block = section.block || section.id || sectionKey;

          switch (block) {
            default:
              try {
                let content = section.component;
                if (!content) {
                  const DynamicBlock = await getThemeBlock(block);
                  content = (
                    <DynamicBlock
                      section={section}
                      {...(data || section.data || {})}
                    />
                  );
                }

                return (
                  <AnimatedContent
                    key={sectionKey}
                    className="w-full"
                    distance={block === 'hero' ? 28 : 64}
                    duration={block === 'hero' ? 0.75 : 0.85}
                    ease="power3.out"
                    initialOpacity={0}
                    blur={block === 'hero' ? 0 : 4}
                    threshold={0.12}
                    trigger={block === 'hero' ? 'mount' : 'scroll'}
                    once={false}
                  >
                    {content}
                  </AnimatedContent>
                );
              } catch (error) {
                return null;
              }
          }
        })}
    </>
  );
}
