# Skyworks

An example project from [Shader Development Studio](https://shader.se) showing a few things you can do with Three.js, React Three Fiber, WebGPU, render targets, and Three Shading Language.

The site is a fake brand page for **Skyworks**, an imaginary company that seems to work with skies. Exactly what Skyworks actually does is utterly vague. They are probably in the business of atmospheric possibility, horizon intelligence, aerial readiness, or some other convincing-sounding sky-adjacent activity.

The idea and design were made up along the way. There was no clear concept at the start, no clear concept at the end, and very little effort was spent pretending otherwise. There are airplanes flying over a cylinder made out of ASCII planes, a sky video turning into glyphs, and branded copy about tomorrow's skies. What is that supposed to mean? Don't ask me.

The concept is inspired by [Lusion](https://lusion.co)'s Oryzo site, which presents an AI-powered coaster for a fictional product. Oryzo is a much more ambitious and polished project, and the comparison ends at the loose idea of making a fictional product/company site. This demo should not be read as a quality, scope, or craft comparison. Their made-up company has a clearer idea than this one. Credit where credit is due.

## What This Demo Shows

The main point of this project is not the fictional company. It is the rendering setup behind the scroll experience.

- Multiple R3F scenes are rendered into separate framebuffers.
- Scene textures are passed forward so one section can transition into the next.
- A final composition scene blends those render targets before post processing.
- Transitions are driven by scroll progress rather than route changes.
- Three.js WebGPU and TSL node materials are used for shader-style effects.
- Video is sampled into an ASCII sky treatment.
- A mouse-weight pass creates interactive displacement and highlight data.
- Bloom, chromatic aberration, film grain, color adjustment, and lens-style effects are composed in a WebGPU render pipeline.

It is mainly a playground for building cinematic section transitions with render targets.

## Tech Stack

- [Next.js](https://nextjs.org)
- [React](https://react.dev)
- [Three.js](https://threejs.org)
- [React Three Fiber](https://r3f.docs.pmnd.rs)
- [Three Shading Language](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Lenis](https://lenis.darkroom.engineering)
- [Motion](https://motion.dev)
- [Tailwind CSS](https://tailwindcss.com)

## Running Locally

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

You need a browser with WebGPU support enabled. Recent Chrome-based browsers are the safest bet.

## Project Structure

Most of the interesting code lives in `src/components`.

- `renderer.tsx` creates the R3F canvas with Three's `WebGPURenderer` and controls the manual render order.
- `scenes/compose-scene.tsx` combines the scene render targets and runs the final post-processing pass.
- `scenes/hero` contains the intro scene, curved planes, animated airplane instances, and the first transition.
- `scenes/about` contains the ASCII/video sky scene and the airplane-led transition into the end scene.
- `asci-background.tsx` renders the interactive ASCII sky texture used by the hero scene.
- `mouse-weight-pass.tsx` renders pointer movement into a texture used for interactive displacement.
- `post-processing` contains the WebGPU/TSL post-processing nodes.
- `scroll-container.tsx`, `store.ts`, and `pages-config.ts` connect Lenis scroll state to scene progress.

## About The State Of The Project

This was thrown together by [Filip Kantedal](https://github.com/kantedal) over a few days as a Shader Development Studio demo. It is intentionally experimental and there are plenty of optimizations and improvements left to make.

Known rough edges:

- Mobile has not really been tested. Please test carefully before assuming it works on phones or tablets.
- WebGPU browser support is still not universal.
- The render pipeline favors experimentation over production hardening.
- Some effects, assets, and scene transitions could be made lighter and more configurable.
- Accessibility, responsive layout, and reduced-motion behavior need proper attention before using this as a real site.

Treat this as a reference and starting point, not a polished production template.

## Credits

Created by [Filip Kantedal](https://github.com/kantedal) for [Shader Development Studio](https://shader.se).

Concept inspiration: Lusion's Oryzo site.
