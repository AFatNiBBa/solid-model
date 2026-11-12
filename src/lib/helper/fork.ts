
import * as signals from "@solidjs/signals";

export const { newest } = signals;

if (typeof newest !== "function")
    throw new Error(`This library requires the "@seanalunni/signals" fork, check the installation guide here "https://www.npmjs.com/package/@seanalunni/signals#using-it-in-an-app"`);