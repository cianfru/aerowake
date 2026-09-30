import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IATA_RE } from './import-format';

interface HomeBaseFieldProps {
  label: string;
  help: ReactNode;
  initial?: string;
  submitLabel: string;
  busy?: boolean;
  /** Error from the server for the code the pilot submitted (unknown airport...). */
  error?: string;
  autoFocus?: boolean;
  onSubmit: (base: string) => void;
  onCancel?: () => void;
}

/**
 * A 3-letter IATA base entry. Enter submits; no request per keystroke
 * (roster endpoints are rate-limited). Not a <form>, so it can sit inside one.
 */
export function HomeBaseField({ label, help, initial = '', submitLabel, busy, error, autoFocus, onSubmit, onCancel }: HomeBaseFieldProps) {
  const [value, setValue] = useState(initial.toUpperCase());
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const valid = IATA_RE.test(value);
  const localError = touched && !valid ? 'Enter a 3-letter airport code, for example DOH.' : '';
  const message = localError || error;

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  const submit = () => {
    setTouched(true);
    if (!valid || busy) {
      inputRef.current?.focus();
      return;
    }
    onSubmit(value);
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p>
      <div className="flex flex-wrap items-start gap-2">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={(e) => { setValue(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3)); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            if (e.key === 'Escape' && onCancel) { e.preventDefault(); onCancel(); }
          }}
          placeholder="e.g. DOH"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={3}
          readOnly={busy}
          className="h-10 w-28 font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal"
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id}-help ${id}-error` : `${id}-help`}
        />
        <Button type="button" onClick={submit} aria-disabled={busy || undefined} className="h-10">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} className="h-10">Cancel</Button>
        )}
      </div>
      {message && <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">{message}</p>}
    </div>
  );
}
