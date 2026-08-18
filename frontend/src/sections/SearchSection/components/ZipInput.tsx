import React from "react";
import { MapPin } from "lucide-react";

interface ZipInputProps {
  value: string;
  onChange: (v: string) => void;
}

/**
 * Search anywhere in the US. Five digits are geocoded server-side from the
 * Census ZCTA table; anything else is ignored until it's complete, so the list
 * doesn't thrash while someone is still typing.
 */
export const ZipInput: React.FC<ZipInputProps> = ({ value, onChange }) => {
  const complete = /^\d{5}$/.test(value);

  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <MapPin
          className={complete ? "text-blue-500" : "text-gray-500 dark:text-gray-400"}
          size={18}
        />
      </span>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={5}
        aria-label="ZIP code"
        placeholder="ZIP"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
        className="w-28 text-base bg-gray-100 dark:bg-gray-800 dark:text-gray-100 h-9 border pl-9 pr-3 py-1 rounded-lg border-transparent dark:border-gray-700 md:text-sm focus:outline-none focus:border-blue-500 focus:ring-0 placeholder:text-gray-500 dark:placeholder:text-gray-400"
      />
    </div>
  );
};
