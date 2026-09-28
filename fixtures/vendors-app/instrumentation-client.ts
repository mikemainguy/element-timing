// Runs before hydration, after withElementTiming's client module. Both sinks hold events until
// their vendor script has loaded, so this also exercises the replay path when the vendor scripts
// are delayed (DELAY_MS).
import { connectDynatrace } from "next-element-timing/dynatrace";
import { connectNewRelic } from "next-element-timing/newrelic";

connectNewRelic();
connectDynatrace();
