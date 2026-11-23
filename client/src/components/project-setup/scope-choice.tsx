import { useState } from "react";
import { Input } from "@/components/ui/input";

/** A real dropdown with an inline escape hatch for ad-hoc scope names. */
export function ScopeChoice({
  value, onChange, options, label, placeholder, disabled = false, autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  label: string;
  placeholder: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [customSelected, setCustomSelected] = useState(false);
  const custom = customSelected || (!!value && !options.includes(value));
  return <div className="min-w-0 space-y-2">
    <select
      aria-label={label}
      autoFocus={autoFocus}
      disabled={disabled}
      className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 text-sm"
      value={custom ? "custom" : value ? `option:${value}` : ""}
      onChange={event => {
        if (event.target.value === "custom") {
          setCustomSelected(true);
          onChange("");
        } else {
          setCustomSelected(false);
          onChange(event.target.value.replace(/^option:/, ""));
        }
      }}
    >
      <option value="" disabled>{placeholder}</option>
      {options.map(option => <option key={option} value={`option:${option}`}>{option}</option>)}
      <option value="custom">Other / custom</option>
    </select>
    {custom && <Input
      aria-label={`Custom ${label.toLowerCase()}`}
      disabled={disabled}
      maxLength={200}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={`Enter ${label.toLowerCase()}`}
    />}
  </div>;
}
