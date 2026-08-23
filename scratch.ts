import { veniceFetch } from "./src/services/veniceClient/fetch";
import { defaultModelResolver } from "./src/services/defaultModelResolver";

async function test() {
  console.log("Testing fetch models...");
  try {
    const res = await veniceFetch("/models");
    console.log("Models:", res.data?.data?.length);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}
test();
