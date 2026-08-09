import { defineConfig } from 'drizzle-kit'
import { dbSsl } from './lib/db/ssl'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    // Same pinned root and host policy as the app connection. Migrations carry
    // the whole schema and run with more privilege than any request does, so this
    // is the last connection that should be the unverified one.
    ssl: dbSsl(process.env.DATABASE_URL ?? ''),
  },
  verbose: true,
  strict: true,
})
