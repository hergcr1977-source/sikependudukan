"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

interface ComboInputProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[] | string[];
  placeholder?: string;
  className?: string;
  listId?: string;
}

/**
 * ComboInput — Input text dengan datalist (HTML combobox).
 * User bisa mengetik bebas ATAU memilih dari daftar dropdown.
 * Jika value tidak ada di options, tetap ditampilkan sebagai text.
 */
function ComboInput({ value, onChange, options, placeholder = "Pilih atau ketik...", className, listId }: ComboInputProps) {
  const id = listId || React.useId().replace(/:/g, "_");

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
        placeholder={placeholder}
        list={id}
        className={cn("text-sm", className)}
      />
      <datalist id={id}>
        {options.map(opt => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </div>
  );
}

export { ComboInput };
