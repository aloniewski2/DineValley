import React from "react";
import { Sidebar } from "./sections/Sidebar";
import { MainContent } from "./sections/MainContent";

export const App = () => {
  return (
    <body className="text-[oklch(0.145_0_0)] text-base not-italic normal-nums font-normal accent-auto bg-white box-border caret-transparent block tracking-[normal] leading-6 list-outside list-disc outline-[oklab(0.708_0_0_/_0.5)] text-left indent-[0px] normal-case visible border-separate font-ui_sans_serif">
      <div className="box-border caret-transparent outline-[oklab(0.708_0_0_/_0.5)]">
        <div className="box-border caret-transparent h-[952px] outline-[oklab(0.708_0_0_/_0.5)] translate-y-12">
          <div className="fixed box-border caret-transparent h-[952px] outline-[oklab(0.708_0_0_/_0.5)] overflow-auto inset-0">
            <div className="relative box-border caret-transparent basis-0 grow shrink-0 h-[952px] min-h-px min-w-px outline-[oklab(0.708_0_0_/_0.5)] w-full">
              <div className="box-border caret-transparent flex min-h-[1000px] outline-[oklab(0.708_0_0_/_0.5)] w-full">
                <div className="box-border caret-transparent flex min-h-[952px] outline-[oklab(0.708_0_0_/_0.5)] w-full">
                  <div className="box-content caret-black min-h-0 min-w-0 outline-black md:aspect-auto md:box-border md:caret-transparent md:min-h-[auto] md:min-w-[auto] md:outline-[oklab(0.708_0_0_/_0.5)] md:overscroll-x-auto md:overscroll-y-auto md:snap-align-none md:snap-normal md:snap-none md:decoration-auto md:underline-offset-auto md:[mask-position:0%] md:bg-left-top md:scroll-m-0 md:scroll-p-[auto]">
                    <div className="static box-content caret-black outline-black w-auto md:relative md:aspect-auto md:box-border md:caret-transparent md:outline-[oklab(0.708_0_0_/_0.5)] md:overscroll-x-auto md:overscroll-y-auto md:snap-align-none md:snap-normal md:snap-none md:decoration-auto md:underline-offset-auto md:w-64 md:[mask-position:0%] md:bg-left-top md:scroll-m-0 md:scroll-p-[auto]"></div>
                    <Sidebar />
                  </div>
                  <MainContent />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
  );
};
