import type { ConnectionOptions } from 'node:tls'

/**
 * TLS settings for the Postgres connection.
 *
 * Imported by `lib/db/index.ts` (the app), `drizzle.config.ts` (migrations), and
 * `scripts/db-probe.mts` (connectivity check). One copy of the certificate, one
 * host policy, three callers — a per-call-site literal is how two of them ended
 * up disagreeing with each other in the first place.
 *
 * Why pin at all: `rejectUnauthorized: false`, which all three used before,
 * accepts *any* certificate the peer presents. A party able to intercept the
 * Vercel-to-Supabase leg could terminate TLS themselves and read every statement
 * — the customer phone numbers the unlock gate exists to protect, and every token
 * ledger write.
 *
 * Supabase signs the pooler certificate with its own private root, which is in no
 * public trust store, so default verification cannot succeed and that is why the
 * check was disabled rather than fixed. Supplying the root as `ca` restores
 * verification in full, including the hostname check — the leaf really does carry
 * `CN=*.pooler.supabase.com`, so nothing about the hostname was ever the problem.
 *
 * Provenance of the certificate below, verified 2026-08-09:
 *   Subject/Issuer  CN=Supabase Root 2021 CA, O=Supabase Inc  (self-signed root)
 *   Valid           2021-04-28 .. 2031-04-26
 *   SHA-256         80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:
 *                   82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
 *
 * The root served by the live pooler was fingerprinted and compared against the
 * copy Supabase publishes at
 * https://supabase-downloads.s3.ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
 * over verified HTTPS; the two matched. Reading the root out of the handshake
 * alone would have proved nothing — an interceptor supplies its own root — so the
 * second, independently trusted channel is what makes this pin worth anything.
 *
 * Certificate expires April 2031. Re-verify against the published copy before then.
 */
export const SUPABASE_ROOT_CA_2021 = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal'])

function hostOf(connectionString: string): string {
  try {
    return new URL(connectionString).hostname
  } catch {
    return ''
  }
}

/**
 * TLS options derived from the connection string's host.
 *
 * Derived rather than configured: a flag is the thing most likely to be left at
 * the wrong value in one environment, and the wrong value here either fails shut
 * (cannot connect, obvious) or fails open (no verification, silent).
 *
 * - Supabase host     pin the private root above; full chain + hostname check
 * - localhost         no TLS at all; a local Postgres has no certificate to verify
 * - anything else     verify against the system trust store
 *
 * An unparseable connection string returns strict options, so a malformed URL
 * cannot quietly become an unverified connection.
 */
export function dbSsl(connectionString: string): ConnectionOptions | false {
  const host = hostOf(connectionString)

  if (host.endsWith('.supabase.com') || host.endsWith('.supabase.co')) {
    return { ca: SUPABASE_ROOT_CA_2021, rejectUnauthorized: true, servername: host }
  }

  if (LOCAL_HOSTS.has(host)) return false

  return { rejectUnauthorized: true }
}
