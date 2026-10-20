'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarCheck,
  Target,
  Route,
  BarChart2,
  LayoutTemplate,
  Settings,
  Plus,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command';

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }

        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    const handleCustomOpen = () => setOpen(true);

    document.addEventListener('keydown', down);
    window.addEventListener('lockin:open-command', handleCustomOpen);

    return () => {
      document.removeEventListener('keydown', down);
      window.removeEventListener('lockin:open-command', handleCustomOpen);
    };
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search missions and tasks..." />
      <CommandList>
        <CommandEmpty>No matching commands found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                router.push('/missions/new');
              })
            }
          >
            <Plus className="mr-2 h-4 w-4 text-primary" />
            <span>Create New Mission</span>
            <CommandShortcut>C</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                router.push('/missions/brain-dump');
              })
            }
          >
            <Sparkles className="mr-2 h-4 w-4 text-info" />
            <span>Brain Dump with AI</span>
            <CommandShortcut>B</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                router.push('/lockin');
              })
            }
          >
            <Zap className="mr-2 h-4 w-4 text-success" />
            <span>Enter Lock-In Mode</span>
            <CommandShortcut>L</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                router.push('/today');
              })
            }
          >
            <CalendarCheck className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Today Overview</span>
            <CommandShortcut>G T</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                router.push('/missions');
              })
            }
          >
            <Target className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Missions & Pipelines</span>
            <CommandShortcut>G M</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                router.push('/runway');
              })
            }
          >
            <Route className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Runway View</span>
            <CommandShortcut>G R</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                router.push('/insights');
              })
            }
          >
            <BarChart2 className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Insights & Analytics</span>
            <CommandShortcut>G I</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                router.push('/templates');
              })
            }
          >
            <LayoutTemplate className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Mission Templates</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                router.push('/settings');
              })
            }
          >
            <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Settings & Preferences</span>
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
