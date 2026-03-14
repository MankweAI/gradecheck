import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT, "generated", "launch-index-manifest.json");
const ENV_PATH = path.join(ROOT, ".env.local");

const TOTAL_INDEX_BUDGET = Number(process.env.LAUNCH_INDEX_BUDGET ?? 250);
const CONTRACTOR_PROFILE_BUDGET = Number(process.env.LAUNCH_CONTRACTOR_PROFILE_BUDGET ?? 75);

const PROVINCE_SLUGS = {
  "Eastern Cape": "eastern-cape",
  "Free State": "free-state",
  Gauteng: "gauteng",
  "KwaZulu-Natal": "kwazulu-natal",
  Limpopo: "limpopo",
  Mpumalanga: "mpumalanga",
  "North West": "north-west",
  "Northern Cape": "northern-cape",
  "Western Cape": "western-cape",
};

const CLASS_CODE_SLUGS = {
  CE: "civil-engineering-ce",
  GB: "general-building-gb",
  EP: "electrical-public-installations-ep",
  EB: "electrical-building-installations-eb",
  ME: "mechanical-engineering-me",
  SQ: "specialist-piling-foundations-sq",
  SH: "specialist-structural-steelwork-sh",
  SF: "specialist-formwork-falsework-sf",
  SO: "specialist-roofing-waterproofing-so",
  SN: "specialist-painting-decorating-sn",
  SG: "specialist-glazing-sg",
  SL: "specialist-landscaping-sl",
  SK: "specialist-lifts-escalators-sk",
  SB: "specialist-demolition-sb",
};

const LEGAL_SUFFIX_PATTERN = /\b(?:pty(?:\s*ltd)?|ltd|cc)\b/gi;

const SEO_QUALITY_THRESHOLDS = {
  provinceMinContractors: 10,
  provinceMinLeafPages: 1,
  cityMinContractors: 5,
  cityMinLeafPages: 1,
  leafMinContractors: 5,
  leafMinActiveContractors: 1,
  leafMinEvidenceBackedContractors: 1,
  contractorMinGradings: 1,
  gradeMinLocations: 1,
  gradeMinClasses: 1,
  classMinContractors: 5,
  classMinLeafPages: 1,
};

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/&/g, " and ")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeContractorNameForSlug(contractorName) {
  return contractorName
    .replace(/[()]/g, " ")
    .replace(LEGAL_SUFFIX_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildProvinceSlug(province) {
  return PROVINCE_SLUGS[province] ?? slugify(province);
}

function buildCitySlug(city) {
  return slugify(city);
}

function buildClassSlug(classCode) {
  return CLASS_CODE_SLUGS[classCode] ?? slugify(classCode);
}

function buildProvinceHref(province) {
  return `/cidb-contractors/${buildProvinceSlug(province)}`;
}

function buildCityHref(province, city) {
  return `${buildProvinceHref(province)}/${buildCitySlug(city)}`;
}

function buildLeafHref(province, city, gradeLevel, classCode) {
  return `${buildCityHref(province, city)}/grade-${gradeLevel}/${buildClassSlug(classCode)}`;
}

function buildContractorHref(crsNumber, contractorName) {
  return `/cidb-contractor/${crsNumber}-${slugify(normalizeContractorNameForSlug(contractorName))}`;
}

function buildGradePageHref(grade) {
  return `/cidb-grades/cidb-grade-${grade}`;
}

function buildClassCodeHref(classCode) {
  return `/cidb-class-codes/${buildClassSlug(classCode)}`;
}

function shouldIndexProvincePage({ contractorCount, leafPageCount }) {
  return (
    contractorCount >= SEO_QUALITY_THRESHOLDS.provinceMinContractors &&
    leafPageCount >= SEO_QUALITY_THRESHOLDS.provinceMinLeafPages
  );
}

function shouldIndexCityPage({ contractorCount, leafPageCount }) {
  return (
    contractorCount >= SEO_QUALITY_THRESHOLDS.cityMinContractors &&
    leafPageCount >= SEO_QUALITY_THRESHOLDS.cityMinLeafPages
  );
}

function shouldIndexLeafPage({ contractorCount, activeCount, evidenceBackedContractors }) {
  return (
    contractorCount >= SEO_QUALITY_THRESHOLDS.leafMinContractors &&
    activeCount >= SEO_QUALITY_THRESHOLDS.leafMinActiveContractors &&
    evidenceBackedContractors >= SEO_QUALITY_THRESHOLDS.leafMinEvidenceBackedContractors
  );
}

function shouldIndexContractorPage({ gradingCount, hasSourceUrl, hasCapturedAt }) {
  return (
    gradingCount >= SEO_QUALITY_THRESHOLDS.contractorMinGradings &&
    hasSourceUrl &&
    hasCapturedAt
  );
}

function shouldIndexGradePage({ locationCount, classCount }) {
  return (
    locationCount >= SEO_QUALITY_THRESHOLDS.gradeMinLocations &&
    classCount >= SEO_QUALITY_THRESHOLDS.gradeMinClasses
  );
}

function shouldIndexClassCodePage({ contractorCount, leafPageCount }) {
  return (
    contractorCount >= SEO_QUALITY_THRESHOLDS.classMinContractors &&
    leafPageCount >= SEO_QUALITY_THRESHOLDS.classMinLeafPages
  );
}

async function loadEnvFile() {
  try {
    const raw = await fs.readFile(ENV_PATH, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore if missing
  }
}

async function main() {
  await loadEnvFile();

  const pool = new pg.Pool({
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? "cidb_contractors",
    user: process.env.PGUSER ?? "postgres",
    password: process.env.PGPASSWORD ?? "postgres",
  });

  const essentials = new Set([
    "/",
    "/verify-cidb-contractor",
    "/about-gradeverify",
    "/methodology",
    "/data-updates",
    "/how-to-verify-a-cidb-contractor",
    "/cidb-registration-status-explained",
    "/what-is-a-pe-contractor",
    "/cidb-grades",
    "/cidb-class-codes",
  ]);

  try {
    const [
      provincesResult,
      citiesResult,
      leafPagesResult,
      classSummariesResult,
      contractorsResult,
      contractorGradingsResult,
      provinceStatsResult,
      provinceLeafCountsResult,
      cityLeafCountsResult,
      gradeClassesResult,
      gradeLocationsResult,
    ] = await Promise.all([
      pool.query(`SELECT DISTINCT province FROM contractors ORDER BY province ASC`),
      pool.query(`SELECT province, city, COUNT(*)::int AS count FROM contractors GROUP BY province, city ORDER BY province ASC, city ASC`),
      pool.query(`
        SELECT c.province, c.city, g.grade_level, g.class_code, COUNT(DISTINCT c.crs_number)::int AS count
        FROM contractors c
        INNER JOIN contractor_gradings g ON g.crs_number = c.crs_number
        GROUP BY c.province, c.city, g.grade_level, g.class_code
        HAVING COUNT(DISTINCT c.crs_number) >= 5
      `),
      pool.query(`
        SELECT g.class_code, COUNT(DISTINCT g.crs_number)::int AS contractor_count
        FROM contractor_gradings g
        GROUP BY g.class_code
      `),
      pool.query(`
        SELECT crs_number, contractor_name, registration_status, source_url, captured_at, province, city
        FROM contractors
      `),
      pool.query(`
        SELECT crs_number, grade_level, class_code
        FROM contractor_gradings
      `),
      pool.query(`
        SELECT province, COUNT(*)::int AS total
        FROM contractors
        GROUP BY province
      `),
      pool.query(`
        SELECT c.province, COUNT(*)::int AS leaf_page_count
        FROM (
          SELECT c.province, c.city, g.grade_level, g.class_code
          FROM contractors c
          INNER JOIN contractor_gradings g ON g.crs_number = c.crs_number
          GROUP BY c.province, c.city, g.grade_level, g.class_code
          HAVING COUNT(DISTINCT c.crs_number) >= 5
        ) c
        GROUP BY c.province
      `),
      pool.query(`
        SELECT c.province, c.city, COUNT(*)::int AS leaf_page_count
        FROM (
          SELECT c.province, c.city, g.grade_level, g.class_code
          FROM contractors c
          INNER JOIN contractor_gradings g ON g.crs_number = c.crs_number
          GROUP BY c.province, c.city, g.grade_level, g.class_code
          HAVING COUNT(DISTINCT c.crs_number) >= 5
        ) c
        GROUP BY c.province, c.city
      `),
      pool.query(`
        SELECT grade_level, COUNT(DISTINCT class_code)::int AS class_count
        FROM contractor_gradings
        GROUP BY grade_level
      `),
      pool.query(`
        SELECT g.grade_level, COUNT(DISTINCT c.province || '|' || c.city)::int AS location_count
        FROM contractors c
        INNER JOIN contractor_gradings g ON g.crs_number = c.crs_number
        GROUP BY g.grade_level
      `),
    ]);

    const provinces = provincesResult.rows.map((row) => row.province);
    const cities = citiesResult.rows;
    const leafPages = leafPagesResult.rows;
    const classSummaries = classSummariesResult.rows;
    const contractors = contractorsResult.rows;
    const gradings = contractorGradingsResult.rows;

    const gradingsByContractor = new Map();
    for (const grading of gradings) {
      const current = gradingsByContractor.get(grading.crs_number) ?? [];
      current.push(grading);
      gradingsByContractor.set(grading.crs_number, current);
    }

    const provinceStats = new Map(provinceStatsResult.rows.map((row) => [row.province, Number(row.total)]));
    const provinceLeafCounts = new Map(provinceLeafCountsResult.rows.map((row) => [row.province, Number(row.leaf_page_count)]));
    const cityLeafCounts = new Map(cityLeafCountsResult.rows.map((row) => [`${row.province}|${row.city}`, Number(row.leaf_page_count)]));
    const gradeClassCounts = new Map(gradeClassesResult.rows.map((row) => [Number(row.grade_level), Number(row.class_count)]));
    const gradeLocationCounts = new Map(gradeLocationsResult.rows.map((row) => [Number(row.grade_level), Number(row.location_count)]));

    const dynamicCandidates = [];
    const contractorCandidates = [];

    for (const province of provinces) {
      const contractorCount = provinceStats.get(province) ?? 0;
      const leafPageCount = provinceLeafCounts.get(province) ?? 0;
      if (shouldIndexProvincePage({ contractorCount, leafPageCount })) {
        dynamicCandidates.push({
          href: buildProvinceHref(province),
          score: 300 + (leafPageCount * 18) + (contractorCount * 0.8),
        });
      }
    }

    for (const city of cities) {
      const contractorCount = Number(city.count);
      const leafPageCount = cityLeafCounts.get(`${city.province}|${city.city}`) ?? 0;
      if (shouldIndexCityPage({ contractorCount, leafPageCount })) {
        dynamicCandidates.push({
          href: buildCityHref(city.province, city.city),
          score: 450 + (leafPageCount * 22) + (contractorCount * 1.4),
        });
      }
    }

    for (const page of leafPages) {
      const matchingContractors = contractors.filter((contractor) => {
        if (contractor.province !== page.province || contractor.city !== page.city) {
          return false;
        }

        const contractorGradings = gradingsByContractor.get(contractor.crs_number) ?? [];
        return contractorGradings.some(
          (grading) =>
            Number(grading.grade_level) === Number(page.grade_level) &&
            grading.class_code === page.class_code,
        );
      });

      const activeCount = matchingContractors.filter(
        (contractor) => contractor.registration_status === "Active",
      ).length;

      if (
        shouldIndexLeafPage({
          contractorCount: Number(page.count),
          activeCount,
          evidenceBackedContractors: Number(page.count),
        })
      ) {
        dynamicCandidates.push({
          href: buildLeafHref(page.province, page.city, Number(page.grade_level), page.class_code),
          score: 900 + (Number(page.count) * 28) + (activeCount * 16) + (Number(page.grade_level) * 4),
        });
      }
    }

    for (let grade = 1; grade <= 9; grade += 1) {
      const classCount = gradeClassCounts.get(grade) ?? 0;
      const locationCount = gradeLocationCounts.get(grade) ?? 0;
      if (shouldIndexGradePage({ locationCount, classCount })) {
        dynamicCandidates.push({
          href: buildGradePageHref(grade),
          score: 220 + (locationCount * 10) + (classCount * 8),
        });
      }
    }

    for (const classSummary of classSummaries) {
      const leafPageCount = leafPages.filter((page) => page.class_code === classSummary.class_code).length;
      if (
        shouldIndexClassCodePage({
          contractorCount: Number(classSummary.contractor_count),
          leafPageCount,
        })
      ) {
        dynamicCandidates.push({
          href: buildClassCodeHref(classSummary.class_code),
          score: 240 + (leafPageCount * 16) + Number(classSummary.contractor_count),
        });
      }
    }

    for (const contractor of contractors) {
      const contractorGradings = gradingsByContractor.get(contractor.crs_number) ?? [];
      if (
        shouldIndexContractorPage({
          gradingCount: contractorGradings.length,
          hasSourceUrl: Boolean(contractor.source_url),
          hasCapturedAt: Boolean(contractor.captured_at),
        })
      ) {
        const highestGrade = contractorGradings.reduce(
          (max, grading) => Math.max(max, Number(grading.grade_level)),
          0,
        );
        const isActiveBoost = contractor.registration_status === "Active" ? 180 : 0;
        contractorCandidates.push({
          href: buildContractorHref(contractor.crs_number, contractor.contractor_name),
          score: 120 + isActiveBoost + (contractorGradings.length * 35) + (highestGrade * 6),
        });
      }
    }

    const uniqueDynamic = [...new Map(dynamicCandidates.map((item) => [item.href, item])).values()]
      .sort((left, right) => right.score - left.score || left.href.localeCompare(right.href));
    const uniqueContractors = [...new Map(contractorCandidates.map((item) => [item.href, item])).values()]
      .sort((left, right) => right.score - left.score || left.href.localeCompare(right.href));

    const allowed = new Set(essentials);
    const dynamicBudget = Math.max(TOTAL_INDEX_BUDGET - allowed.size - CONTRACTOR_PROFILE_BUDGET, 0);
    for (const item of uniqueDynamic.slice(0, dynamicBudget)) {
      allowed.add(item.href);
    }

    const remainingSlots = Math.max(TOTAL_INDEX_BUDGET - allowed.size, 0);
    const contractorBudget = Math.min(CONTRACTOR_PROFILE_BUDGET, remainingSlots);
    for (const item of uniqueContractors.slice(0, contractorBudget)) {
      allowed.add(item.href);
    }

    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(
      OUTPUT_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          totalBudget: TOTAL_INDEX_BUDGET,
          contractorBudget,
          allowed: [...allowed].sort(),
        },
        null,
        2,
      ),
      "utf8",
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Failed to generate launch index manifest");
  console.error(error);
  process.exit(1);
});
