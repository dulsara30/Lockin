'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, Target, Route, BarChart2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const mobileNavItems = [
  { title: 'Today', href: '/today', icon: CalendarCheck },
  { title: 'Missions', href: '/missions', icon: Target },
  { title: 'Runway', href: '/runway', icon: Route },
  { title: 'Insights', href: '/insights', icon: BarChart2 },
  { title: 'Settings', href: '/settings', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/90 backdrop-blur-lg px-2 py-1.5 safe-area-bottom">
      <div className="flex items-center justify-around">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all text-xs font-medium',
                isActive ? 'text-primary scale-105' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn('p-1 rounded-lg transition-colors', isActive && 'bg-primary/10')}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] mt-0.5">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
