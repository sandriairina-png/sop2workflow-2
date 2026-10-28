'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { authClient, signIn } from '@/core/auth/client';
import { Link, useRouter } from '@/core/i18n/navigation';
import { defaultLocale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useAppContext } from '@/shared/contexts/app';
import { cn } from '@/shared/lib/utils';

import { SocialProviders } from './social-providers';

export function SignInForm({
  callbackUrl = '/',
  className,
}: {
  callbackUrl: string;
  className?: string;
}) {
  const t = useTranslations('common.sign');
  const router = useRouter();
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { configs } = useAppContext();

  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const isGithubAuthEnabled = configs.github_auth_enabled === 'true';
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' ||
    (!isGoogleAuthEnabled && !isGithubAuthEnabled); // no social providers enabled, auto enable email auth
  const hasSocialProviders = isGoogleAuthEnabled || isGithubAuthEnabled;

  if (callbackUrl) {
    if (
      locale !== defaultLocale &&
      callbackUrl.startsWith('/') &&
      !callbackUrl.startsWith(`/${locale}`)
    ) {
      callbackUrl = `/${locale}${callbackUrl}`;
    }
  }

  const base = locale !== defaultLocale ? `/${locale}` : '';
  const stripLocalePrefix = (path: string) => {
    if (!path?.startsWith('/')) return '/';
    if (locale === defaultLocale) return path;
    if (path === `/${locale}`) return '/';
    if (path.startsWith(`/${locale}/`))
      return path.slice(locale.length + 1) || '/';
    return path;
  };

  const handleSignIn = async () => {
    if (loading) {
      return;
    }

    if (!email || !password) {
      toast.error('email and password are required');
      return;
    }

    // Set loading immediately to avoid duplicate submits before request hooks fire.
    setLoading(true);

    try {
      await signIn.email(
        {
          email,
          password,
          callbackURL: callbackUrl,
        },
        {
          onRequest: (ctx) => {
            // loading is already set above; keep as no-op for safety
          },
          onResponse: (ctx) => {
            // Do NOT reset loading here; navigation may not have completed yet.
          },
          onSuccess: (ctx) => {
            // Keep loading=true until navigation completes.
          },
          onError: (e: any) => {
            const status = e?.error?.status;
            if (status === 403) {
              const normalizedCallbackUrl = stripLocalePrefix(callbackUrl);
              const verifyPath = `/verify-email?sent=1&email=${encodeURIComponent(
                email
              )}&callbackUrl=${encodeURIComponent(normalizedCallbackUrl)}`;

              // Send verification email with callback to verify page.
              void authClient.sendVerificationEmail({
                email,
                callbackURL: `${base}${verifyPath}`,
              });

              // i18n router will prefix locale automatically; do NOT include locale here.
              router.push(verifyPath);
              return;
            }

            toast.error(e?.error?.message || 'sign in failed');
            setLoading(false);
          },
        }
      );
    } catch (e: any) {
      toast.error(e?.message || 'sign in failed');
      setLoading(false);
    }
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="grid gap-5 px-6 pb-2 md:px-8">
        {hasSocialProviders && (
          <SocialProviders
            configs={configs}
            callbackUrl={callbackUrl || '/'}
            loading={loading}
            setLoading={setLoading}
          />
        )}

        {hasSocialProviders && isEmailAuthEnabled && (
          <div className="text-center" aria-hidden="true">
            <span className="text-xs text-white/34">{t('or')}</span>
          </div>
        )}

        {isEmailAuthEnabled && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSignIn();
            }}
          >
            <div className="grid gap-2.5">
              <Label
                htmlFor="email"
                className="text-[13px] font-medium text-white/68"
              >
                {t('email_title')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t('email_placeholder')}
                autoComplete="email"
                required
                className="h-12 rounded-[14px] border-white/[0.12] bg-white/[0.045] px-4 text-[15px] text-white shadow-none placeholder:text-white/28 focus-visible:border-white/55 focus-visible:ring-0"
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                value={email}
              />
            </div>

            <div className="grid gap-2.5">
              <Label
                htmlFor="password"
                className="text-[13px] font-medium text-white/68"
              >
                {t('password_title')}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={t('password_placeholder')}
                autoComplete="current-password"
                className="h-12 rounded-[14px] border-white/[0.12] bg-white/[0.045] px-4 text-[15px] text-white shadow-none placeholder:text-white/28 focus-visible:border-white/55 focus-visible:ring-0"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              onClick={() => {
                setRememberMe(!rememberMe);
              }}
            />
            <Label htmlFor="remember">{t("remember_me_title")}</Label>
          </div> */}

            <Button
              type="submit"
              className="mt-1 h-12 w-full rounded-full bg-white text-sm font-semibold text-[#08090d] shadow-none transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/92 focus-visible:ring-white/55 disabled:translate-y-0"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span className="sr-only">{t('sign_in_title')}</span>
                </>
              ) : (
                <span>{t('sign_in_title')}</span>
              )}
            </Button>
          </form>
        )}
      </div>
      {isEmailAuthEnabled && (
        <div className="flex w-full justify-center px-6 pt-4 pb-7 md:px-8 md:pb-8">
          <p className="text-center text-sm text-white/38">
            {t('no_account')}
            <Link
              href="/sign-up"
              className="ml-1 font-medium text-white underline decoration-white/28 underline-offset-4 transition-colors hover:decoration-white"
            >
              <span className="cursor-pointer">{t('sign_up_title')}</span>
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
