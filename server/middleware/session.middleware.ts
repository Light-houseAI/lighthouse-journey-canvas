import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Container } from "../core/container-setup.js";
import { getPoolFromDatabase } from "../config/database.config.js";
import { CONTAINER_TOKENS } from "../core/container-tokens.js";

// Configure PostgreSQL session store
const PgSession = connectPgSimple(session);

/**
 * Create session middleware with database connection from container
 * This function must be called after the container is configured
 */
export function createSessionMiddleware() {
  const container = Container.getContainer();
  const database = container.resolve(CONTAINER_TOKENS.DATABASE);
  const pool = getPoolFromDatabase(database);

  return session({
    store: new PgSession({
      pool: pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "dev-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  });
}