'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer';
import { useAppContext } from '@/shared/contexts/app';
import { useMediaQuery } from '@/shared/hooks/use-media-query';

import { SignInForm } from './sign-in-form';

const desktopDialogClassName =
  'sop-sign-dialog gap-0 overflow-hidden rounded-[28px] border-white/[0.12] bg-[#08090d] p-0 text-white shadow-[0_28px_90px_rgba(0,0,0,0.58)] sm:max-w-[480px]'; // taste-skill-ignore: a modal needs visible elevation above its overlay

export function SignModal({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const t = useTranslations('common.sign');
  const { isShowSignModal, setIsShowSignModal } = useAppContext();

  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return (
      <Dialog open={isShowSignModal} onOpenChange={setIsShowSignModal}>
        <DialogContent
          data-ui="auth-dialog"
          overlayClassName="sop-sign-overlay"
          className={desktopDialogClassName}
          showCloseButton={false}
        >
          <div className="sop-sign-aurora" aria-hidden="true" />
          <DialogClose asChild>
            <button
              type="button"
              onClick={() => setIsShowSignModal(false)}
              className="absolute top-5 right-5 z-20 grid size-10 place-items-center rounded-full border border-white/10 bg-black/25 text-white/55 transition hover:border-white/24 hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              aria-label={t('cancel_title')}
            >
              <X className="size-4" />
            </button>
          </DialogClose>
          <DialogHeader className="relative z-10 gap-0 px-8 pt-8 pb-6 text-left">
            <div className="mb-8 flex items-center gap-3">
              <Image
                src="/logo.svg"
                alt=""
                width={38}
                height={38}
                className="size-[38px]"
              />
              <span className="text-sm font-semibold tracking-[-0.02em] text-white/88">
                SOP2Workflow
              </span>
            </div>
            <DialogTitle className="max-w-sm text-[30px] leading-[1.08] font-semibold tracking-[-0.035em] text-white">
              {t('modal_title')}
            </DialogTitle>
            <DialogDescription className="mt-3 max-w-sm text-sm leading-6 text-white/48">
              {t('modal_description')}
            </DialogDescription>
          </DialogHeader>
          <SignInForm callbackUrl={callbackUrl} className="relative z-10" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isShowSignModal} onOpenChange={setIsShowSignModal}>
      <DrawerContent
        data-ui="auth-dialog"
        overlayClassName="sop-sign-overlay"
        className="sop-sign-dialog max-h-[92svh] rounded-t-[28px] border-white/[0.12] bg-[#08090d] text-white"
      >
        <div className="sop-sign-aurora" aria-hidden="true" />
        <DrawerClose asChild>
          <button
            type="button"
            onClick={() => setIsShowSignModal(false)}
            className="absolute top-5 right-5 z-20 grid size-10 place-items-center rounded-full border border-white/10 bg-black/25 text-white/55 transition hover:border-white/24 hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            aria-label={t('cancel_title')}
          >
            <X className="size-4" />
          </button>
        </DrawerClose>
        <DrawerHeader className="relative z-10 px-6 pt-5 text-left">
          <div className="mb-5 flex items-center gap-3">
            <Image src="/logo.svg" alt="" width={34} height={34} />
            <span className="text-sm font-semibold text-white/88">
              SOP2Workflow
            </span>
          </div>
          <DrawerTitle className="text-[26px] leading-tight tracking-[-0.03em] text-white">
            {t('modal_title')}
          </DrawerTitle>
          <DrawerDescription className="mt-2 max-w-sm leading-6 text-white/48">
            {t('modal_description')}
          </DrawerDescription>
        </DrawerHeader>
        <SignInForm
          callbackUrl={callbackUrl}
          className="relative z-10 mt-4 px-6"
        />
        <DrawerFooter className="relative z-10 px-6 pt-3 pb-6">
          <DrawerClose asChild>
            <Button
              variant="outline"
              className="h-11 rounded-full border-white/12 bg-transparent text-white/60 hover:bg-white/6 hover:text-white"
            >
              {t('cancel_title')}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
