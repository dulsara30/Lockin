'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, Clock, AlertCircle } from 'lucide-react';

interface ConfirmStartDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayIndex: number;
  missionTitle: string;
  onConfirm: (dayIndex: number) => Promise<void>;
}

export function ConfirmStartDayModal({
  isOpen,
  onClose,
  dayIndex,
  missionTitle,
  onConfirm,
}: ConfirmStartDayModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(dayIndex);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-surface border-border p-6 shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
            <Clock className="h-4 w-4" />
            <span>24-Hour Day Execution</span>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Start Day {dayIndex + 1} for &ldquo;{missionTitle}&rdquo;?
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-2">
            Starting Day {dayIndex + 1} activates a <strong>strict 24-hour timer</strong>.
            <br />
            <br />
            &bull; You will have exactly 24 hours to finish all scheduled tasks for this day.
            <br />
            &bull; If tasks remain incomplete after 24 hours, the day will be flagged as overdue and
            will indicate a schedule drag on your overall mission health.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-4 border-t border-border/60 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="text-xs bg-primary hover:bg-primary-hover text-white font-semibold gap-1.5 shadow-md shadow-primary/20"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{isSubmitting ? 'Starting Day...' : 'Start 24h Clock'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
