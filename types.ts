
export interface PlannerEvent {
  id: string;
  title: string;
  date: string; // ISO format (Starting Date)
  poName?: string;
  awbBlName?: string;
  category: 'local_process' | 'tec_processing' | 'tec_approved' | 'customs_clearance' | 'delivery';
  description?: string;
}

export interface DayData {
  date: Date;
  isToday: boolean;
  isWeekend: boolean;
  events: PlannerEvent[];
}

export interface MonthData {
  name: string;
  year: number;
  days: DayData[];
}

export enum EventCategory {
  LOCAL_PROCESS = 'local_process',
  TEC_PROCESSING = 'tec_processing',
  TEC_APPROVED = 'tec_approved',
  CUSTOMS_CLEARANCE = 'customs_clearance',
  DELIVERY = 'delivery',
}

export const CATEGORY_COLORS: Record<string, string> = {
  local_process: 'bg-red-500',
  tec_processing: 'bg-[#8B4513]', // Brown
  tec_approved: 'bg-green-500',
  customs_clearance: 'bg-blue-600',
  delivery: 'bg-gray-500',
};

export const CATEGORY_LABELS: Record<string, string> = {
  local_process: 'Local Process',
  tec_processing: 'TEC Processing',
  tec_approved: 'Approved TEC',
  customs_clearance: 'CC Processing',
  delivery: 'Delivery',
};
