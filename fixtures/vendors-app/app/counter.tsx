"use client";

import { useState } from "react";
import { timingProps } from "next-element-timing";

export function Counter({ name }: { name: string }) {
  const [count, setCount] = useState(0);
  return (
    <button {...timingProps(name)} onClick={() => setCount(count + 1)}>
      Clicked {count}
    </button>
  );
}
