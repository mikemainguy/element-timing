import Link from "next/link";
import { Counter } from "../counter";
import { runOf, type RunSearchParams } from "../run";

export default async function Two({ searchParams }: { searchParams: RunSearchParams }) {
  const { run, prefix } = await runOf(searchParams);
  return (
    <main>
      <h1 data-timing={`${prefix}two-heading`} elementtiming={`${prefix}two-heading`}>
        Page two
      </h1>
      <p>
        <Counter name={`${prefix}two-button`} />
      </p>
      <p>
        <Link href={`/?run=${run}`}>Back</Link>
      </p>
    </main>
  );
}
