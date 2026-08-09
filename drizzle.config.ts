import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    // The Supabase pooler serves a certificate for its own hostname, so the
    // chain is not verifiable from here even though the link is encrypted.
    ssl: { rejectUnauthorized: false },
  },
  verbose: true,
  strict: true,
})
