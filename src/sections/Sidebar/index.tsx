import React from 'react';
import { SidebarMenu } from "./components/SidebarMenu";

export const Sidebar = () => {
  return (
    <div className="static box-content caret-black block h-auto outline-black w-auto z-auto border-r-0 left-auto inset-y-auto md:fixed md:aspect-auto md:box-border md:caret-transparent md:flex md:h-[1000px] md:outline-[oklab(0.708_0_0_/_0.5)] md:overscroll-x-auto md:overscroll-y-auto md:snap-align-none md:snap-normal md:snap-none md:decoration-auto md:underline-offset-auto md:w-64 md:z-10 md:[mask-position:0%] md:bg-left-top md:scroll-m-0 md:scroll-p-[auto] md:border-r md:border-solid md:border-black/10 md:left-0 md:inset-y-0">
      <div className="bg-transparent box-content caret-black block flex-row h-auto min-h-0 min-w-0 outline-black w-auto md:aspect-auto md:bg-[oklch(0.985_0_0)] md:box-border md:caret-transparent md:flex md:flex-col md:h-full md:min-h-[auto] md:min-w-[auto] md:outline-[oklab(0.708_0_0_/_0.5)] md:overscroll-x-auto md:overscroll-y-auto md:snap-align-none md:snap-normal md:snap-none md:decoration-auto md:underline-offset-auto md:w-full md:[mask-position:0%] md:bg-left-top md:scroll-m-0 md:scroll-p-[auto]">
        <div className="box-content caret-black gap-x-[normal] block basis-auto flex-row grow-0 min-w-0 outline-black gap-y-[normal] md:aspect-auto md:box-border md:caret-transparent md:gap-x-2 md:flex md:basis-[0%] md:flex-col md:grow md:min-w-[auto] md:outline-[oklab(0.708_0_0_/_0.5)] md:overscroll-x-auto md:overscroll-y-auto md:gap-y-2 md:snap-align-none md:snap-normal md:snap-none md:decoration-auto md:underline-offset-auto md:overflow-auto md:[mask-position:0%] md:bg-left-top md:scroll-m-0 md:scroll-p-[auto]">
          <div className="static box-content caret-black block flex-row min-h-0 outline-black w-auto md:relative md:aspect-auto md:box-border md:caret-transparent md:flex md:flex-col md:min-h-[auto] md:outline-[oklab(0.708_0_0_/_0.5)] md:overscroll-x-auto md:overscroll-y-auto md:snap-align-none md:snap-normal md:snap-none md:decoration-auto md:underline-offset-auto md:w-full md:[mask-position:0%] md:bg-left-top md:p-2 md:scroll-m-0 md:scroll-p-[auto]">
            <div className="text-base box-content caret-black leading-[normal] min-h-0 min-w-0 outline-black w-auto md:text-sm md:aspect-auto md:box-border md:caret-transparent md:leading-5 md:min-h-[auto] md:min-w-[auto] md:outline-[oklab(0.708_0_0_/_0.5)] md:overscroll-x-auto md:overscroll-y-auto md:snap-align-none md:snap-normal md:snap-none md:decoration-auto md:underline-offset-auto md:w-full md:[mask-position:0%] md:bg-left-top md:scroll-m-0 md:scroll-p-[auto]">
              <SidebarMenu />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
