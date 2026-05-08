import { type MotionValue, motionValue } from "motion/react";

export type PageEffects = {
  contrast: number;
  brightness: number;
  saturation: number;
  bloomIntensity: number;
};

export type PageRenderOffset = {
  before: number;
  after: number;
};

export type PageType = "hero" | "about" | "end";

export type PageConfig = {
  type: PageType;
  length: number;
  renderOffset?: PageRenderOffset;
};

export type PageConfigWithStartPosition = PageConfig & {
  startPosition: number;
};

export const basePagesConfig: PageConfig[] = [
  {
    type: "hero",
    length: 4,
  },
  {
    type: "about",
    length: 3,
    renderOffset: {
      before: -2,
      after: 0,
    },
  },
  {
    type: "end",
    length: 2,
    renderOffset: {
      before: -1,
      after: 0,
    },
  },
];

export const pagesConfig: MotionValue<PageConfigWithStartPosition[]> = motionValue<PageConfigWithStartPosition[]>(
  basePagesConfig.map((page, index) => ({
    ...page,
    startPosition: basePagesConfig.slice(0, index).reduce((acc, page) => acc + page.length, 0),
  })),
);
