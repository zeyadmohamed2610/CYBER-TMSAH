export { handlePasskeyRequest } from "./native.ts";
import { handlePasskeyRequest } from "./native.ts";
if (typeof Deno !== "undefined") Deno.serve(handlePasskeyRequest);
