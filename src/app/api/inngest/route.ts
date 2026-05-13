import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { allFunctions } from "@/inngest/functions";

// Exposes POST /api/inngest for the Inngest cloud/dev-server to deliver events.
export const { GET, POST, PUT } = serve({ client: inngest, functions: allFunctions });
