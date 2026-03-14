import "server-only";

import manifest from "@/generated/launch-index-manifest.json";
import { getRobotsForQuality } from "@/lib/indexing";

export async function getLaunchIndexManifest() {
  return {
    allowed: new Set<string>(manifest.allowed),
    totalBudget: manifest.totalBudget,
    contractorBudget: manifest.contractorBudget,
  };
}

export async function shouldLaunchIndexHref(href: string): Promise<boolean> {
  const launchManifest = await getLaunchIndexManifest();
  return launchManifest.allowed.has(href);
}

export async function getLaunchRobotsForHref(href: string, isQualityQualified: boolean) {
  if (!isQualityQualified) {
    return getRobotsForQuality(false);
  }

  return getRobotsForQuality(await shouldLaunchIndexHref(href));
}
