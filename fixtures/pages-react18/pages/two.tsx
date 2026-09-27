import { useState } from "react";
import { timingProps } from "next-element-timing";

export default function Two() {
  const [on, setOn] = useState(false);
  return (
    <button {...timingProps("two-button")} onClick={() => setOn(!on)}>
      {on ? "On" : "Off"}
    </button>
  );
}
