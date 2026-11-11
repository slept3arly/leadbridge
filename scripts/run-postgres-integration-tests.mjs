import { spawnSync } from "node:child_process";

const databaseUrl = process.env.LEADBRIDGE_TEST_DATABASE_URL;
if (!databaseUrl) {
  console.error("LEADBRIDGE_TEST_DATABASE_URL is required. Set it to an isolated PostgreSQL test database before running pnpm test:integration.");
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(databaseUrl);
} catch {
  console.error("LEADBRIDGE_TEST_DATABASE_URL must be a valid PostgreSQL connection URL.");
  process.exit(1);
}

if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
  console.error("LEADBRIDGE_TEST_DATABASE_URL must use the postgres or postgresql protocol.");
  process.exit(1);
}

if (!parsedUrl.hostname || parsedUrl.pathname === "/") {
  console.error("LEADBRIDGE_TEST_DATABASE_URL must include a PostgreSQL host and database name.");
  process.exit(1);
}

if (!/test/i.test(parsedUrl.pathname)) {
  console.error("The LEADBRIDGE_TEST_DATABASE_URL database name must contain 'test'; refusing to run against another database.");
  process.exit(1);
}

const testFiles = [
  "tests/execution-fencing.postgres.test.ts",
  "tests/follow-up-completion.postgres.test.ts",
  "tests/follow-up-lifecycle.postgres.test.ts",
  "tests/dashboard-activity.postgres.test.ts",
  "tests/lead-creation.postgres.test.ts",
  "tests/lead-workflow.postgres.test.ts",
  "tests/note-scheduling.postgres.test.ts",
];
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: "inherit",
});

if (result.error) {
  console.error("Could not start PostgreSQL integration tests:", result.error.message);
  process.exit(1);
}

process.exitCode = result.status ?? 1;
