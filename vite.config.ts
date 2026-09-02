import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import hostingConfig from "./.openai/hosting.json" with { type: "json" };
import { sites } from "./build/sites-vite-plugin.ts";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";
const { d1, r2 } = hostingConfig;

export default defineConfig({
  plugins: [
    vinext({
      cache: { cdn: cdnAdapter() },
    }),
    sites(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
      config: {
        d1_databases: d1 ? [{ binding: d1, database_name: "poolbattle-members", database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID }] : [],
        r2_buckets: r2 ? [{ binding: r2, bucket_name: "poolbattle-member-photos" }] : [],
      },
    }),
  ],
});
