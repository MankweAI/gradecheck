import "server-only";

import { Pool } from "pg";

declare global {
  var __gradecheckPool: Pool | undefined;
}

const pool =
  global.__gradecheckPool ??
  new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  global.__gradecheckPool = pool;
}

export default pool;
