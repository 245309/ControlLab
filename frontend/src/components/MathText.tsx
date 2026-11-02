import { Fragment } from "react";

/** 把 "s^2 + 2s" 这类文本里的指数渲染成上标。 */
export function MathText({ text }: { text: string }) {
  const parts = text.split(/(\^\d+)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("^") ? <sup key={index}>{part.slice(1)}</sup> : <Fragment key={index}>{part}</Fragment>,
      )}
    </>
  );
}
