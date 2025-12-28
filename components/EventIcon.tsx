
import React from 'react';
import { Settings, Loader2, CheckCircle2, ShieldCheck, Truck } from 'lucide-react';

export const EventIcon = ({ category, className }: { category: string, className?: string }) => {
  switch (category) {
    case 'local_process': return <Settings className={className} size={14} />;
    case 'tec_processing': return <Loader2 className={`${className} animate-spin-slow`} size={14} />;
    case 'tec_approved': return <CheckCircle2 className={className} size={14} />;
    case 'customs_clearance': return <ShieldCheck className={className} size={14} />;
    case 'delivery': return <Truck className={className} size={14} />;
    default: return <Settings className={className} size={14} />;
  }
};
