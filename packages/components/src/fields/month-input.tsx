import { Input } from '../base/input';
import { Label } from '../base/label';
import { cn } from '../lib/utils';

export interface MonthInputProps {
  id: string;
  label: string;
  value: string; // "YYYY-MM"
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  min?: string; // "YYYY-MM"
  max?: string; // "YYYY-MM"
  picker?: 'native' | 'dropdown';
  className?: string;
}

export function MonthInput({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  min,
  max,
  // picker = 'native', // Future: can add dropdown fallback
  className,
}: MonthInputProps) {
  // Use native month input for now (can add dropdown fallback later)
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={id}
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        required={required}
        className={cn(error && 'border-destructive')}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
