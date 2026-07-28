"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchBar({ value, onChange, placeholder = "Buscar…", autoFocus }: SearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-catdex-gray-light pointer-events-none" />
      <input
        type="search"
        className="field pl-10"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
