'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  CalendarCheck,
  Target,
  Route,
  BarChart2,
  LayoutTemplate,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Plus,
  Command as CommandIcon,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { title: 'Today', href: '/today', icon: CalendarCheck },
  { title: 'Missions', href: '/missions', icon: Target },
  { title: 'Runway', href: '/runway', icon: Route },
  { title: 'Insights', href: '/insights', icon: BarChart2 },
  { title: 'Templates', href: '/templates', icon: LayoutTemplate },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // Restore sidebar state from localStorage if available
  React.useEffect(() => {
    const saved = localStorage.getItem('lockin_sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('lockin_sidebar_collapsed', String(next));
      return next;
    });
  };

  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Operator';
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'hidden md:flex flex-col h-screen border-r border-border bg-[#0E0E17] select-none transition-all duration-base ease-in-out z-30 shrink-0 sticky top-0',
          isCollapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        {/* Header / Logo */}
        <div className="flex h-16 items-center px-4 justify-between border-b border-border/60">
          <Link
            href="/today"
            className={cn(
              'flex items-center gap-2.5 transition-opacity hover:opacity-90',
              isCollapsed && 'justify-center w-full'
            )}
          >
            {isCollapsed ? (
              <Image
                src="/logo-icon.svg"
                alt="Lockin"
                width={32}
                height={32}
                className="rounded-lg shadow-sm shadow-primary/20"
                priority
              />
            ) : (
              <Image
                src="/logo.svg"
                alt="Lockin"
                width={124}
                height={32}
                className="h-8 w-auto"
                priority
              />
            )}
          </Link>
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Quick Action Button */}
        <div className="p-3">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/missions/new">
                  <Button
                    size="icon"
                    className="w-full h-10 bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">New Mission</TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/missions/new" className="block">
              <Button
                variant="default"
                className="w-full justify-start gap-2 bg-gradient-to-r from-primary to-info text-white font-medium shadow-md shadow-primary/20 hover:opacity-95 transition-all text-xs h-9"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>New Mission</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
          <div className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

              if (isCollapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex h-10 w-full items-center justify-center rounded-xl transition-colors',
                          isActive
                            ? 'bg-surface text-primary border border-primary/20 shadow-sm'
                            : 'text-muted-foreground hover:bg-surface/50 hover:text-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.title}</TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-surface text-foreground border border-border shadow-sm'
                      : 'text-muted-foreground hover:bg-surface/50 hover:text-foreground'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </div>

          {/* Missions List Header */}
          {!isCollapsed && (
            <div className="pt-5 pb-2 px-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Active Pipelines
              </p>
            </div>
          )}

          {/* Mission list items with color dots */}
          <div className="space-y-1">
            {/* Sample pinned mission dots for Phase 1 shell */}
            <div className={cn('px-2 py-1', isCollapsed && 'flex justify-center')}>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                {!isCollapsed && (
                  <span className="text-xs text-muted-foreground truncate">Sprint Lock-in</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Area */}
        <div className="border-t border-border/60 p-2 space-y-1">
          {/* Settings link */}
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/settings"
                  className={cn(
                    'flex h-10 w-full items-center justify-center rounded-xl transition-colors',
                    pathname === '/settings'
                      ? 'bg-surface text-primary'
                      : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                  )}
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                pathname === '/settings'
                  ? 'bg-surface text-foreground border border-border'
                  : 'text-muted-foreground hover:bg-surface/50 hover:text-foreground'
              )}
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Settings</span>
            </Link>
          )}

          {/* User Profile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl p-2 text-left hover:bg-surface/70 transition-colors focus:outline-none',
                  isCollapsed && 'justify-center p-1.5'
                )}
              >
                <Avatar className="h-8 w-8 ring-1 ring-border">
                  <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {session?.user?.email}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align={isCollapsed ? 'center' : 'start'}
              className="w-56"
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-xs font-medium text-foreground">{userName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {session?.user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Preferences</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('lockin:open-command'));
                }}
                className="flex items-center gap-2"
              >
                <CommandIcon className="h-4 w-4" />
                <span>Command Menu</span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">⌘K</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-danger focus:text-danger focus:bg-danger/10 flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Collapsed expand button at bottom */}
          {isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              className="w-full h-8 text-muted-foreground hover:text-foreground mt-1"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
