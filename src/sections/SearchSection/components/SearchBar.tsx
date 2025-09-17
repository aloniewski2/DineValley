import React, { useState } from 'react';
import { Search } from 'lucide-react';

export const SearchBar = () => {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="relative w-full">
      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Search className="text-gray-500" size={20} />
      </span>
      <input
        placeholder="Search restaurants, cuisine, or mood..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="w-full text-base bg-gray-100 flex h-9 leading-6 text-start border pl-10 pr-3 py-1 rounded-lg border-transparent md:text-sm md:leading-5
          focus:outline-none focus:border-blue-500 focus:ring-0"
      />
    </div>
  );
};
