import React from "react";

interface SurpriseMeButtonProps {
  onClick?: () => void;
  disabled?: boolean;
}

export const SurpriseMeButton: React.FC<SurpriseMeButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-sm font-medium items-center bg-white dark:bg-gray-900 dark:text-gray-100 caret-transparent gap-x-2 flex shrink-0 h-9 justify-center leading-5 outline-[oklab(0.708_0_0_/_0.5)] gap-y-2 text-nowrap border px-3 py-2 rounded-lg border-solid border-black/10 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <img
        src="https://c.animaapp.com/mfn8xsm35Iri3M/assets/icon-10.svg"
        alt="Surprise me icon"
        className="box-border caret-transparent shrink-0 h-4 outline-[oklab(0.708_0_0_/_0.5)] text-nowrap w-4 mr-2 dark:invert dark:brightness-0"
      />
      Surprise Me!
    </button>
  );
};
