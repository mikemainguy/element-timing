import Link from "next/link";
import { useState } from "react";
import { timingProps } from "next-element-timing";

export default function Home() {
  const [count, setCount] = useState(0);
  return (
    <main>
      <button {...timingProps("counter")} onClick={() => setCount(count + 1)}>
        Clicked {count}
      </button>
      <Link href="/two" data-timing="to-two" elementtiming="to-two">
        Page two
      </Link>
    </main>
  );
}
