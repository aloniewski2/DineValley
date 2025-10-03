import React from 'react';

export const Header = () => {
    return (
      <header className="sticky backdrop-blur bg-[oklab(0.999994_0.0000455677_0.0000200868_/_0.6)] box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)] z-40 border-b border-solid border-black/10 top-0">
        <div className="items-center box-border caret-transparent gap-x-4 flex h-14 outline-[oklab(0.708_0_0_/_0.5)] gap-y-4 px-4">
          <button className="text-sm font-medium items-center bg-transparent caret-transparent gap-x-2 flex shrink-0 h-7 justify-center leading-5 outline-[oklab(0.708_0_0_/_0.5)] gap-y-2 text-nowrap w-7 p-0 rounded-lg">
            <img
              src="https://c.animaapp.com/mfn8xsm35Iri3M/assets/icon-7.svg"
              alt="Icon"
              className="box-border caret-transparent shrink-0 h-4 outline-[oklab(0.708_0_0_/_0.5)] text-nowrap w-4"
            />
          </button>
          <div className="items-center box-border caret-transparent gap-x-2 flex outline-[oklab(0.708_0_0_/_0.5)] gap-y-2">
            <div className="items-center bg-gray-950 box-border caret-transparent flex h-8 justify-center outline-[oklab(0.708_0_0_/_0.5)] w-8 rounded-[10px]">
              <span className="text-[oklch(1_0_0)] text-sm font-bold box-border caret-transparent block leading-5 outline-[oklab(0.708_0_0_/_0.5)]">
                DV
              </span>
            </div>
            <span className="text-lg font-semibold box-border caret-transparent block leading-7 outline-[oklab(0.708_0_0_/_0.5)]">
              DineValley
            </span>
          </div>
        </div>
      </header>
    );
  };
  
