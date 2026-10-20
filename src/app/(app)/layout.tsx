import * as React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 overflow-y-auto">
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
