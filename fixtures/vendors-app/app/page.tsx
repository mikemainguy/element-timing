import Link from "next/link";
import { Counter } from "./counter";
import { runOf, type RunSearchParams } from "./run";

export default async function Home({ searchParams }: { searchParams: RunSearchParams }) {
  const { run, prefix } = await runOf(searchParams);
  return (
    <main>
      <h1 data-timing={`${prefix}heading`} elementtiming={`${prefix}heading`}>
        Harness run {run}
      </h1>
      <p>
        <Counter name={`${prefix}button`} />
      </p>
      <p>
        <Link href={`/two?run=${run}`} data-timing={`${prefix}link`} elementtiming={`${prefix}link`}>
          Page two (client-side navigation)
        </Link>
      </p>
    </main>
  );
}
