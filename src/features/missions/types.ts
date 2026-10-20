export interface MissionWithRunway {
  _id: string;
  title: string;
  description?: string;
  color: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dayCount: number;
  startDate: string;
  deadline: string;
  status: string;
  tags?: string[];
  hasRunway?: boolean;
  runway?: {
    _id: string;
    title: string;
    dayCount: number;
    startDate?: string;
    deadline?: string;
  } | null;
  stepCount?: number;
  completedStepCount?: number;
  completionRatePercent?: number;
  totalEstimateMin?: number;
  completedEstimateMin?: number;
  health?: string;
}
