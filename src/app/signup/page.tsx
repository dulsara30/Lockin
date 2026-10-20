import { Suspense } from 'react';
import Image from 'next/image';
import { Metadata } from 'next';
import { SignupForm } from '@/features/auth/components/signup-form';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your private Lockin workspace',
};

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 bg-brand-glow pointer-events-none" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-[#14141F]/90 backdrop-blur-xl p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/logo.svg"
            alt="Lockin"
            width={160}
            height={40}
            className="h-10 w-auto mb-4"
            priority
          />
          <h1 className="text-xl font-bold tracking-tight text-foreground">Lock In</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Build your personal mission control pipeline
          </p>
        </div>

        <Suspense
          fallback={
            <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
              Loading...
            </div>
          }
        >
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
