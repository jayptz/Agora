interface StatChipProps {
  label: string;
  value: string | number;
}

export function StatChip({ label, value }: StatChipProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-orange-400">{label}</span>
      <span className="text-sm font-mono text-white">{value}</span>
    </div>
  );
}
