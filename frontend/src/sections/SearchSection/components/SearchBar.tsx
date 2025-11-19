import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => (
  <div className="relative w-full">
    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <Search className="text-gray-500 dark:text-gray-400" size={20} />
    </span>
    <input
      placeholder="Search restaurants, cuisine, or mood..."
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full text-base bg-gray-100 dark:bg-gray-800 dark:text-gray-100 flex h-9 leading-6 text-start border pl-10 pr-3 py-1 rounded-lg border-transparent dark:border-gray-700 md:text-sm md:leading-5 focus:outline-none focus:border-blue-500 focus:ring-0 placeholder:text-gray-500 dark:placeholder:text-gray-400"
    />
  </div>
);
