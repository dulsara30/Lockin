'use client';

import React, { useState } from 'react';
import { UserSettingsResponse } from '@/server/dal/settings';
import {
  updateSettingsAction,
  saveCustomGeminiKeyAction,
  removeCustomGeminiKeyAction,
  exportAllUserDataAction,
} from '@/features/settings/actions';
import { applyTheme } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  Laptop,
  Key,
  Clock,
  Globe,
  Calendar,
  Download,
  Upload,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConnectedApps } from '@/features/oauth/components/connected-apps';
import type { ConnectedApp } from '@/server/dal/oauth';

interface SettingsViewProps {
  initialSettings: UserSettingsResponse;
  userEmail?: string | null;
  connectedApps?: ConnectedApp[];
}

export function SettingsView({
  initialSettings,
  userEmail,
  connectedApps = [],
}: SettingsViewProps) {
  const [settings, setSettings] = useState<UserSettingsResponse>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);

  // Gemini API Key form state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);

  // Appearance & General
  const handleUpdateTheme = async (theme: 'dark' | 'light' | 'system') => {
    setSettings((prev) => ({ ...prev, theme }));
    applyTheme(theme);
    const res = await updateSettingsAction({ theme });
    if (res.success && res.settings) {
      setSettings(res.settings);
      toast.success(`Theme updated to ${theme}`);
    }
  };

  const handleUpdateWorkHours = async (hours: number) => {
    setSettings((prev) => ({ ...prev, workHoursPerDay: hours }));
    await updateSettingsAction({ workHoursPerDay: hours });
    toast.success('Work capacity updated.');
  };

  const handleUpdateWeekdayCapacity = async (dayKey: string, hours: number) => {
    const updated = { ...settings.capacityByWeekday, [dayKey]: hours };
    setSettings((prev) => ({ ...prev, capacityByWeekday: updated }));
    await updateSettingsAction({ capacityByWeekday: updated });
  };

  const handleSaveGeminiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    setIsTestingKey(true);
    try {
      const res = await saveCustomGeminiKeyAction(apiKeyInput);
      if (res.success && res.settings) {
        setSettings(res.settings);
        setApiKeyInput('');
        toast.success(
          'Custom Gemini Key encrypted and verified successfully! 100 calls/day unlocked.'
        );
      } else {
        toast.error(res.error || 'Failed to authenticate key.');
      }
    } catch {
      toast.error('Unexpected error verifying key.');
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleRemoveGeminiKey = async () => {
    if (
      !confirm(
        'Are you sure you want to remove your custom Gemini key? Your quota will revert to 10 calls/day.'
      )
    ) {
      return;
    }

    const res = await removeCustomGeminiKeyAction();
    if (res.success && res.settings) {
      setSettings(res.settings);
      toast.success('Custom key removed. Reverted to shared system key.');
    }
  };

  const handleExportData = async () => {
    setIsSaving(true);
    try {
      const res = await exportAllUserDataAction();
      if (res.success && res.json && res.filename) {
        const blob = new Blob([res.json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Data export downloaded successfully.');
      } else {
        toast.error(res.error || 'Export failed.');
      }
    } catch {
      toast.error('Error during data export.');
    } finally {
      setIsSaving(false);
    }
  };

  const weekdayLabels: Record<string, string> = {
    '1': 'Monday',
    '2': 'Tuesday',
    '3': 'Wednesday',
    '4': 'Thursday',
    '5': 'Friday',
    '6': 'Saturday',
    '0': 'Sunday',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
          <SettingsIcon className="h-3.5 w-3.5" />
          <span>User Configuration</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Settings & Customization
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personalize working hours, theme, encrypted AI keys, and portable data backups.
        </p>
      </div>

      {/* 1. Appearance & Theme */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Moon className="h-4 w-4 text-primary" />
          Appearance
        </h3>
        <p className="text-xs text-muted-foreground">
          Select your visual interface theme. Dark-first design is optimized for focus.
        </p>

        <div className="grid grid-cols-3 gap-3 max-w-md pt-2">
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleUpdateTheme(t)}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-semibold capitalize transition-all ${
                settings.theme === t
                  ? 'border-primary bg-primary/20 text-foreground shadow-md shadow-primary/20'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              {t === 'dark' && <Moon className="h-4 w-4" />}
              {t === 'light' && <Sun className="h-4 w-4" />}
              {t === 'system' && <Laptop className="h-4 w-4" />}
              <span>{t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Working Capacity & Schedule */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-6">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-info" />
            Working Hours & Daily Capacity
          </h3>
          <p className="text-xs text-muted-foreground">
            Lockin uses your capacity targets to calculate runway risk and warn you when a day is
            overloaded.
          </p>
        </div>

        {/* Global Hours Per Day */}
        <div className="space-y-2 max-w-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Default Work Hours / Day:</span>
            <span className="font-mono font-bold text-primary">
              {settings.workHoursPerDay} hrs/day
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={14}
            value={settings.workHoursPerDay}
            onChange={(e) => handleUpdateWorkHours(parseInt(e.target.value, 10) || 4)}
            className="w-full accent-primary cursor-pointer"
          />
        </div>

        {/* Per-Weekday Capacity Grid */}
        <div className="space-y-3 pt-3 border-t border-border">
          <span className="text-xs font-semibold text-foreground block">
            Capacity by Weekday (Hours):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {['1', '2', '3', '4', '5', '6', '0'].map((dayKey) => {
              const val =
                settings.capacityByWeekday[dayKey] ?? (dayKey === '0' || dayKey === '6' ? 0 : 4);
              return (
                <div
                  key={dayKey}
                  className="p-3 rounded-xl border border-border bg-background text-center space-y-1.5"
                >
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    {weekdayLabels[dayKey]}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={val}
                    onChange={(e) =>
                      handleUpdateWeekdayCapacity(dayKey, parseInt(e.target.value, 10) || 0)
                    }
                    className="w-14 mx-auto bg-surface border border-border text-center text-xs font-mono font-bold text-foreground rounded-md py-1"
                  />
                  <span className="text-[10px] text-muted-foreground block">hrs</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. AI Rules & Custom BYOK Gemini Key */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Key className="h-4 w-4 text-warning" />
              Gemini AI Integration (BYOK)
            </h3>
            <p className="text-xs text-muted-foreground">
              Bring your own free Gemini API key to unlock 100 AI generation calls per day.
            </p>
          </div>

          <div>
            {settings.hasCustomGeminiKey ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-lime/15 text-lime border border-lime/30">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Custom Key Active (100/day)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-background text-muted-foreground border border-border">
                <span>Shared Quota (10/day)</span>
              </span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-background space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your key is encrypted on the server using <strong>AES-256-GCM</strong>. It is never
            logged or transmitted to the client.
          </p>

          <form onSubmit={handleSaveGeminiKey} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={
                  settings.hasCustomGeminiKey
                    ? 'Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢'
                    : 'Paste your Google AI Studio API key...'
                }
                className="bg-surface border-border text-xs text-foreground pr-10 rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button
              type="submit"
              disabled={isTestingKey}
              className="bg-primary hover:bg-primary/90 text-white font-medium text-xs px-5 rounded-xl shadow-md shadow-primary/20 shrink-0"
            >
              {isTestingKey ? 'Verifying...' : 'Save & Encrypt'}
            </Button>

            {settings.hasCustomGeminiKey && (
              <Button
                type="button"
                variant="danger"
                onClick={handleRemoveGeminiKey}
                className="text-xs rounded-xl shrink-0 gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove Key
              </Button>
            )}
          </form>
        </div>
      </div>

      {/* 4. Data Portability & Backup */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Download className="h-4 w-4 text-cyan" />
            Data Backup & Portability
          </h3>
          <p className="text-xs text-muted-foreground">
            Lockin respects your data sovereignty. Download a full JSON archive of your missions,
            pipeline steps, and timelogs anytime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            onClick={handleExportData}
            disabled={isSaving}
            className="bg-background hover:bg-surface-hover text-foreground border border-border text-xs gap-2 rounded-xl px-4 py-2"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span>Export All Data (JSON)</span>
          </Button>
        </div>
      </div>

      {/* 5. Connected apps (MCP / OAuth) */}
      <ConnectedApps initialApps={connectedApps} />
    </div>
  );
}
