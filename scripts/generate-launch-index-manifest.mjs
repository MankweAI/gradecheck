import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./load-local-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT, "generated", "launch-index-manifest.json");
const PUBLISHABILITY_PATH = path.join(ROOT, "generated", "pipeline", "publishability-manifest.json");

async function main() {
  await loadLocalEnv();

  try {
    const raw = await fs.readFile(PUBLISHABILITY_PATH, "utf8");
    const publishabilityManifest = JSON.parse(raw);

    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(
      OUTPUT_PATH,
      JSON.stringify(
        {
          generatedAt: publishabilityManifest.generatedAt,
          totalBudget: publishabilityManifest.totalBudget,
          contractorBudget: publishabilityManifest.contractorBudget,
          allowed: publishabilityManifest.budgetedAllowedUrls ?? [],
        },
        null,
        2,
      ),
      "utf8",
    );
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.access(OUTPUT_PATH);
  console.log(
    "Publishability manifest not found; using committed generated/launch-index-manifest.json for this build.",
  );
}

main().catch((error) => {
  console.error("Failed to generate launch index manifest");
  console.error(error);
  process.exit(1);
});
