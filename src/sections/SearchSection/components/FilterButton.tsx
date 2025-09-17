import React from 'react';

export const FilterButton = () => {
    return (
      <button
        type="button"
        className="relative text-sm font-medium items-center bg-white caret-transparent gap-x-2 flex shrink-0 h-9 justify-center leading-5 outline-[oklab(0.708_0_0_/_0.5)] gap-y-2 text-nowrap border px-3 py-2 rounded-lg border-solid border-black/10"
      >
        <img
          src="https://c.animaapp.com/mfn8xsm35Iri3M/assets/icon-9.svg"
          alt="Icon"
          className="box-border caret-transparent shrink-0 h-4 outline-[oklab(0.708_0_0_/_0.5)] text-nowrap w-4 mr-2"
        />
        Filters
      </button>
    );
  };
  