import { type MotionValue, motionValue } from "motion/react";
import type { PageType } from "./pages-config";

export const scrollPosition: MotionValue<number> = motionValue<number>(0);

export const scrollVelocity: MotionValue<number> = motionValue<number>(0);

export const activePage: MotionValue<PageType> = motionValue<PageType>("hero");

export const pageLoaded: MotionValue<boolean> = motionValue<boolean>(false);

export const pageLoadProgress: MotionValue<number> = motionValue<number>(0);

export const introAnimationProgress: MotionValue<number> = motionValue<number>(0);

export const introAnimationCompleted: MotionValue<boolean> = motionValue<boolean>(false);
