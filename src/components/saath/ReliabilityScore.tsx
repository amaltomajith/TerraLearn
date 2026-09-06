import { ShieldCheck } from 'lucide-react';
import { useAsync } from '@/lib/saath/useAsync';
import { getPaymentReliability } from '@/lib/saath/queries';

export function ReliabilityScore({ farmerId, label = 'Payment reliability' }: { farmerId: string; label?: string }) {
  const { data } = useAsync(() => getPaymentReliability(farmerId), [farmerId]);

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5">
      <ShieldCheck className="w-4 h-4 text-primary" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-semibold text-foreground">
        {data?.avg_score != null ? `${data.avg_score.toFixed(1)} / 5` : 'No ratings'}
      </span>
      {data && data.n > 0 && (
        <span className="text-[10px] text-muted-foreground">({data.n})</span>
      )}
    </div>
  );
}
