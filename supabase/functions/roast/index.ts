// Supabase Edge Function: roast
// The logic lives in handler.ts (see there for env vars and provider priority).
import { handler } from "./handler.ts";

Deno.serve(handler);
