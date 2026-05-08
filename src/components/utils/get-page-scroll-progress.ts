import { type PageType, pagesConfig } from "../pages-config";
import { scrollPosition } from "../store";
import { pixelsToPageHeightUnits } from "./page-height-units";

export function getPageScrollProgress({
  pageType,
  clamp = true,
  startOffset = 0,
}: {
  pageType: PageType;
  clamp?: boolean;
  startOffset?: number;
  endOffset?: number;
}) {
  const scroll = pixelsToPageHeightUnits(scrollPosition.get());

  // console.log(scrollPosition.get() / window.innerHeight);

  const page = pagesConfig.get().find((page) => page.type === pageType);

  if (!page) return 0;

  const progress = (scroll - page.startPosition - startOffset) / (page.length - startOffset);

  if (clamp) return Math.min(Math.max(progress, 0), 1);

  return progress;
}
