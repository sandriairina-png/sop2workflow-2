import { ComponentType, lazy, Suspense } from 'react';

import {
  RiAddLine,
  RiChat2Line,
  RiDeleteBinLine,
  RiDiscordFill,
  RiEditLine,
  RiEyeLine,
  RiFlashlightFill,
  RiKeyLine,
  RiLockPasswordLine,
  RiRefreshLine,
  RiTaskLine,
  RiTwitterXFill,
} from './remix-icons';

const iconCache: { [key: string]: ComponentType<any> } = {};

// Icons used by our content, imported statically so pages don't pull in the
// whole react-icons/ri bundle. Other names still load lazily.
const remixIcons: { [key: string]: ComponentType<any> } = {
  RiAddLine,
  RiChat2Line,
  RiDeleteBinLine,
  RiDiscordFill,
  RiEditLine,
  RiEyeLine,
  RiFlashlightFill,
  RiKeyLine,
  RiLockPasswordLine,
  RiRefreshLine,
  RiTaskLine,
  RiTwitterXFill,
};

// Function to automatically detect icon library
function detectIconLibrary(name: string): 'ri' | 'lucide' {
  if (name && name.startsWith('Ri')) {
    return 'ri';
  }

  return 'lucide';
}

export function SmartIcon({
  name,
  size = 24,
  className,
  ...props
}: {
  name: string;
  size?: number;
  className?: string;
  [key: string]: any;
}) {
  const library = detectIconLibrary(name);
  const cacheKey = `${library}-${name}`;

  const StaticIcon = library === 'ri' ? remixIcons[name] : undefined;
  if (StaticIcon) {
    return <StaticIcon size={size} className={className} {...props} />;
  }

  if (!iconCache[cacheKey]) {
    if (library === 'ri') {
      // React Icons (Remix Icons)
      iconCache[cacheKey] = lazy(async () => {
        try {
          const module = await import('react-icons/ri');
          const IconComponent = module[name as keyof typeof module];
          if (IconComponent) {
            return { default: IconComponent as ComponentType<any> };
          } else {
            console.warn(
              `Icon "${name}" not found in react-icons/ri, using fallback`
            );
            return { default: module.RiQuestionLine as ComponentType<any> };
          }
        } catch (error) {
          console.error(`Failed to load react-icons/ri:`, error);
          const fallbackModule = await import('react-icons/ri');
          return {
            default: fallbackModule.RiQuestionLine as ComponentType<any>,
          };
        }
      });
    } else {
      // Lucide React (default)
      iconCache[cacheKey] = lazy(async () => {
        try {
          const module = await import('lucide-react');
          const IconComponent = module[name as keyof typeof module];
          if (IconComponent) {
            return { default: IconComponent as ComponentType<any> };
          } else {
            console.warn(
              `Icon "${name}" not found in lucide-react, using fallback`
            );
            return { default: module.HelpCircle as ComponentType<any> };
          }
        } catch (error) {
          console.error(`Failed to load lucide-react:`, error);
          const fallbackModule = await import('lucide-react');
          return { default: fallbackModule.HelpCircle as ComponentType<any> };
        }
      });
    }
  }

  const IconComponent = iconCache[cacheKey];

  return (
    <Suspense fallback={<div style={{ width: size, height: size }} />}>
      <IconComponent size={size} className={className} {...props} />
    </Suspense>
  );
}
