import type { AppProps } from "next/app";
import Router from "next/router";
import { trackPagesRouter } from "next-element-timing";
import { TimingPanel } from "next-element-timing/panel";

trackPagesRouter(Router);

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <TimingPanel />
    </>
  );
}
