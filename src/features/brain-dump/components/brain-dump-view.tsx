'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ParsedPlan } from '@/lib/templates/parser';
import { PlanPreview } from './plan-preview';
import {
  generatePlanFromAiAction,
  parsePlanFromTemplateAction,
} from '@/features/brain-dump/actions';
import { generateSampleMarkdownTemplate, generateSampleJsonTemplate } from '@/lib/templates/parser';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  FileCode,
  Mic,
  MicOff,
  Download,
  Upload,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Clock,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

export function BrainDumpView() {
  const [activeTab, setActiveTab] = useState<'ai' | 'template'>('ai');
  const [generatedPlan, setGeneratedPlan] = useState<ParsedPlan | null>(null);

  // Path A: AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [days, setDays] = useState(5);
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Path B: Template Import State
  const [templateFormat, setTemplateFormat] = useState<'markdown' | 'json' | 'checklist'>(
    'markdown'
  );
  const [templateContent, setTemplateContent] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Browser Voice Input (Web Speech API)
  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;
    const SpeechRecognition = (win.SpeechRecognition || win.webkitSpeechRecognition) as
      | (new () => {
          continuous: boolean;
          interimResults: boolean;
          start: () => void;
          stop: () => void;
          onresult: (event: {
            resultIndex: number;
            results: Array<Array<{ transcript: string }>>;
          }) => void;
          onerror: () => void;
          onend: () => void;
        })
      | undefined;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: {
      resultIndex: number;
      results: Array<Array<{ transcript: string }>>;
    }) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setAiPrompt((prev) => (prev ? `${prev} ${currentTranscript}` : currentTranscript));
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    if (isListening) {
      try {
        recognition.start();
      } catch {
        // Already started
      }
    } else {
      try {
        recognition.stop();
      } catch {
        // Not active
      }
    }

    return () => {
      try {
        recognition.stop();
      } catch {
        // Cleanup
      }
    };
  }, [isListening]);

  const toggleVoiceInput = () => {
    const win = window as unknown as Record<string, unknown>;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }
    setIsListening((prev) => !prev);
  };

  const handleGenerateAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) {
      toast.error('Please enter what you want to achieve.');
      return;
    }

    setIsGenerating(true);
    setAiError(null);

    try {
      const res = await generatePlanFromAiAction({
        prompt: aiPrompt,
        days,
        hoursPerDay,
        priority,
      });

      if (res.success && res.plan) {
        setGeneratedPlan(res.plan);
        toast.success('Runway pipeline generated! Review and lock in below.');
      } else {
        setAiError(res.error || 'Failed to generate plan.');
        toast.error(res.error || 'Generation failed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error during generation.';
      setAiError(msg);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleParseTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateContent.trim()) {
      toast.error('Please paste or upload template content.');
      return;
    }

    setIsParsing(true);
    setTemplateError(null);

    try {
      const res = await parsePlanFromTemplateAction({
        rawContent: templateContent,
        format: templateFormat,
        options: {
          days,
          hoursPerDay,
          priority,
        },
      });

      if (res.success && res.plan) {
        setGeneratedPlan(res.plan);
        toast.success('Template parsed successfully into runway!');
      } else {
        setTemplateError(res.error || 'Failed to parse template.');
        toast.error(res.error || 'Parsing error.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error.';
      setTemplateError(msg);
      toast.error(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setTemplateContent(content);

      if (file.name.endsWith('.json')) {
        setTemplateFormat('json');
      } else if (file.name.endsWith('.md')) {
        setTemplateFormat('markdown');
      }
    };
    reader.readAsText(file);
  };

  const downloadSampleTemplate = (format: 'markdown' | 'json') => {
    const content =
      format === 'markdown' ? generateSampleMarkdownTemplate() : generateSampleJsonTemplate();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lockin-template-sample.${format === 'markdown' ? 'md' : 'json'}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded sample ${format.toUpperCase()} template.`);
  };

  if (generatedPlan) {
    return <PlanPreview initialPlan={generatedPlan} onBack={() => setGeneratedPlan(null)} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Title & Path Selector */}
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-text">Brain Dump to Plan</h1>
        <p className="text-muted text-sm max-w-xl mx-auto">
          Turn scattered thoughts or structured checklists into an executable multi-day runway. Pick
          your preferred path below.
        </p>

        {/* Tab Switcher */}
        <div className="inline-flex items-center p-1 rounded-xl bg-surface border border-border/80 shadow-sm">
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'ai'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-muted hover:text-text'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Path A: Gemini AI
          </button>
          <button
            onClick={() => setActiveTab('template')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'template'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-muted hover:text-text'
            }`}
          >
            <FileCode className="h-4 w-4" />
            Path B: Template Import (Free / Offline)
          </button>
        </div>
      </div>

      {/* Path A: Gemini AI Brain Dump */}
      {activeTab === 'ai' && (
        <form onSubmit={handleGenerateAi} className="space-y-6">
          <div className="rounded-xl border border-border/80 bg-surface/70 p-6 backdrop-blur space-y-5">
            {aiError && (
              <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{aiError}</p>
                    <p className="text-xs text-danger/80 mt-1">
                      You can instantly switch to the offline Template Import path without any AI
                      quota usage.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('template')}
                  className="shrink-0 text-xs border-danger/40 hover:bg-danger/20 text-danger"
                >
                  Switch to Template
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-text">
                  What are you trying to get done?
                </label>
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
                    isListening
                      ? 'border-danger/60 bg-danger/10 text-danger animate-pulse'
                      : 'border-border/80 bg-bg/50 text-muted hover:text-text'
                  }`}
                  title="Click to dictate using speech"
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-3.5 w-3.5" /> Listening...
                    </>
                  ) : (
                    <>
                      <Mic className="h-3.5 w-3.5" /> Voice Dictate
                    </>
                  )}
                </button>
              </div>

              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={6}
                placeholder="Dump everything here: chaotic objectives, rough steps, requirements, deadlines. Gemini will break it down into realistic daily steps, estimates, and subtasks..."
                className="w-full rounded-lg border border-border bg-bg/70 p-3.5 text-sm text-text placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40 leading-relaxed font-sans"
              />
            </div>

            {/* Pipeline Configuration Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <label className="text-xs text-muted font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> Target Days
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={14}
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value, 10))}
                    className="flex-1 accent-primary"
                  />
                  <span className="font-mono text-sm font-bold text-text w-8 text-right">
                    {days}d
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-info" /> Hours / Day
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(parseInt(e.target.value, 10))}
                    className="flex-1 accent-info"
                  />
                  <span className="font-mono text-sm font-bold text-text w-8 text-right">
                    {hoursPerDay}h
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted font-medium">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                >
                  <option value="low">Low (Flexible)</option>
                  <option value="medium">Medium (Standard)</option>
                  <option value="high">High (Urgent / Lock In)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              Shared quota: 10 calls/day. Add your BYOK key in Settings for 100/day.
            </span>

            <Button
              type="submit"
              disabled={isGenerating}
              className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 shadow-lg shadow-primary/25 gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating Pipeline...
                </>
              ) : (
                <>
                  Generate Runway Pipeline <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Path B: Template Import */}
      {activeTab === 'template' && (
        <form onSubmit={handleParseTemplate} className="space-y-6">
          <div className="rounded-xl border border-border/80 bg-surface/70 p-6 backdrop-blur space-y-5">
            {templateError && (
              <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{templateError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
              {/* Format selection */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted">Format:</span>
                {(['markdown', 'json', 'checklist'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setTemplateFormat(fmt)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                      templateFormat === fmt
                        ? 'bg-primary/20 text-primary border border-primary/40'
                        : 'bg-bg text-muted hover:text-text border border-border/60'
                    }`}
                  >
                    {fmt === 'markdown'
                      ? 'Markdown (.md)'
                      : fmt === 'json'
                        ? 'JSON (.json)'
                        : 'Plain Checklist'}
                  </button>
                ))}
              </div>

              {/* Sample Downloads & Upload Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadSampleTemplate('markdown')}
                  className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text bg-bg border border-border/60 px-2 py-1 rounded"
                  title="Download sample Markdown template"
                >
                  <Download className="h-3 w-3" /> Sample .md
                </button>
                <button
                  type="button"
                  onClick={() => downloadSampleTemplate('json')}
                  className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-text bg-bg border border-border/60 px-2 py-1 rounded"
                  title="Download sample JSON template"
                >
                  <Download className="h-3 w-3" /> Sample .json
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".md,.json,.txt"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:bg-primary/10 border border-primary/40 px-2.5 py-1 rounded transition-colors"
                >
                  <Upload className="h-3 w-3" /> Upload File
                </button>
              </div>
            </div>

            {/* Template Paste Area */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text block">
                Paste Template Text or Checklist:
              </label>
              <textarea
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                rows={10}
                placeholder={
                  templateFormat === 'markdown'
                    ? `# Mission: Launch MVP\ndays: 5\nhoursPerDay: 4\n\n## Day 1\n- [ ] Initial wireframes | 60m | high\n  - [ ] auth flow\n- [ ] Database setup | 90m | high`
                    : templateFormat === 'checklist'
                      ? `- [ ] Build login page | 45m\n- [ ] Design landing hero | 60m\n- [ ] Setup Stripe payment gateway | 120m`
                      : `{\n  "title": "Launch MVP",\n  "dayCount": 5,\n  "hoursPerDay": 4,\n  "days": [...]\n}`
                }
                className="w-full rounded-lg border border-border bg-bg/80 p-3.5 text-xs text-text font-mono placeholder:text-muted/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40 leading-relaxed"
              />
            </div>

            {/* Checklist auto-distribution options */}
            {templateFormat === 'checklist' && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-bg/40 rounded-lg border border-border/40 text-xs">
                <div>
                  <label className="text-muted block mb-1">Distribute across days:</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value, 10) || 5)}
                    className="w-16 bg-surface border border-border rounded px-2 py-1 text-text font-mono"
                  />
                </div>
                <div>
                  <label className="text-muted block mb-1">Target hours per day:</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(parseInt(e.target.value, 10) || 4)}
                    className="w-16 bg-surface border border-border rounded px-2 py-1 text-text font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-lime" />
              100% offline, private, and zero AI cost.
            </span>

            <Button
              type="submit"
              disabled={isParsing}
              className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 shadow-lg shadow-primary/25 gap-2"
            >
              {isParsing ? (
                'Parsing Structure...'
              ) : (
                <>
                  Parse & Preview Runway <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
