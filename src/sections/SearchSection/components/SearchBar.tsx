import React from 'react';

export const SearchBar = () => {
    return (
      <div className="relative box-border caret-transparent basis-[0%] grow outline-[oklab(0.708_0_0_/_0.5)]">
        <img
          src="https://c.animaapp.com/mfn8xsm35Iri3M/assets/icon-8.svg"
          alt="Icon"
          className="absolute text-gray-500 box-border caret-transparent h-4 outline-[oklab(0.708_0_0_/_0.5)] w-4 left-3 top-2/4"
        />
        <input
          placeholder="Search restaurants, cuisine, or mood..."
          value=""
          className="text-base bg-gray-100 box-border caret-transparent flex h-9 leading-6 outline-[oklab(0.708_0_0_/_0.5)] text-start w-full border pl-10 pr-3 py-1 rounded-lg border-solid border-transparent md:text-sm md:leading-5"
        />
      </div>
    );
  };
  