import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

export function BodyHtml({ children }: { children: ReactNode }) {
  const [el] = useState(() => document.createElement("div"));
  const root = useRef<Root | null>(null);

  useLayoutEffect(() => {
    document.body.appendChild(el);
    root.current = createRoot(el);

    return () => {
      root.current?.unmount();
      el.remove();
    };
  }, [el]);

  useLayoutEffect(() => {
    root.current?.render(children);
  });

  return null;
}
