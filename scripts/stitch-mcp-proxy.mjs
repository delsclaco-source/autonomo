// stdio MCP server that proxies Google Stitch's HTTP MCP endpoint and repairs
// its tool schemas on the way through.
//
// Why this exists: Stitch serves 15 tools, but `upload_design_md.outputSchema`
// carries `$ref: "#/$defs/ScreenInstance"` (at `properties.variantScreenInstance`)
// while declaring no `$defs` block. ScreenInstance is self-recursive, so Google
// inlined the type and dropped the definition the recursion points back at.
// Claude Code validates the whole `tools/list` payload, so that one dangling ref
// rejects all 15 tools, not just the broken one. This proxy fills the missing
// definitions from the identical `$defs` the other tools do ship, then forwards
// everything else untouched.
//
// Plain `.mjs` on bare node rather than `.mts` via tsx: an MCP server is spawned
// by the client on every session, so it must not depend on a loader being
// resolvable or pay a transpile cost per start. It imports nothing from `lib/`.
//
// Delete this file once Stitch ships `$defs` and `claude mcp list` reports the
// direct HTTP endpoint as healthy.

const ENDPOINT = 'https://stitch.googleapis.com/mcp'
const API_KEY_ENV = 'STITCH_API_KEY'
const DEFS_PREFIX = '#/$defs/'
const SCHEMA_KEYS = ['inputSchema', 'outputSchema']
const REQUEST_TIMEOUT_MS = 120_000

const apiKey = process.env[API_KEY_ENV]

if (!apiKey) {
  // stderr, never stdout: stdout is the JSON-RPC channel and a stray line there
  // desynchronises the client's frame parser.
  console.error(`stitch-mcp-proxy: ${API_KEY_ENV} is not set`)
  process.exit(1)
}

// Stitch identifies as a stateless server and returned no session header during
// probing, but the spec allows it to start issuing one. Echo it back if it appears.
let sessionId = null

function log(message) {
  console.error(`stitch-mcp-proxy: ${message}`)
}

// ---------------------------------------------------------------------------
// Schema repair
// ---------------------------------------------------------------------------

// Every `#/$defs/<Name>` target reachable from a schema, including refs nested
// inside `$defs` entries themselves.
function collectRefNames(node, found = new Set()) {
  if (!node || typeof node !== 'object') return found

  if (Array.isArray(node)) {
    for (const item of node) collectRefNames(item, found)
    return found
  }

  const ref = node.$ref
  if (typeof ref === 'string' && ref.startsWith(DEFS_PREFIX)) {
    found.add(ref.slice(DEFS_PREFIX.length).split('/')[0])
  }

  for (const value of Object.values(node)) collectRefNames(value, found)
  return found
}

// Pool of definitions harvested across the whole `tools/list` payload. A schema
// missing `ScreenInstance` can borrow the copy `create_project` ships.
function harvestDefs(tools) {
  const pool = new Map()

  for (const tool of tools) {
    for (const key of SCHEMA_KEYS) {
      const defs = tool?.[key]?.$defs
      if (!defs || typeof defs !== 'object') continue

      for (const [name, definition] of Object.entries(defs)) {
        if (!pool.has(name)) pool.set(name, definition)
      }
    }
  }

  return pool
}

// Returns a new schema whose `$defs` covers every ref it makes, or the original
// schema when nothing was missing. Resolves transitively: a borrowed definition
// may reference further names the schema also lacks.
function withMissingDefs(schema, pool, unresolved) {
  if (!schema || typeof schema !== 'object') return schema

  const own = { ...(schema.$defs ?? {}) }
  const added = []
  const pending = [...collectRefNames(schema)]
  const seen = new Set(pending)

  while (pending.length > 0) {
    const name = pending.pop()
    if (own[name]) continue

    const definition = pool.get(name)
    if (!definition) {
      unresolved.add(name)
      continue
    }

    own[name] = definition
    added.push(name)

    for (const nested of collectRefNames(definition)) {
      if (seen.has(nested)) continue
      seen.add(nested)
      pending.push(nested)
    }
  }

  if (added.length === 0) return schema
  return { ...schema, $defs: own, __addedDefs: added }
}

function repairTool(tool, pool) {
  let repaired = tool

  for (const key of SCHEMA_KEYS) {
    const schema = repaired[key]
    if (!schema) continue

    const unresolved = new Set()
    const patched = withMissingDefs(schema, pool, unresolved)

    if (unresolved.size > 0) {
      // Nothing in the payload defines these names, so the schema cannot be made
      // valid. `outputSchema` is optional per spec, so dropping it costs only the
      // client's ability to type-check that tool's result; keeping it would keep
      // every tool unusable. An `inputSchema` in this state is not droppable, so
      // leave it and let the client complain about that one tool by name.
      log(`${tool.name}.${key}: unresolvable refs ${[...unresolved].join(', ')}`)

      if (key === 'outputSchema') {
        const { outputSchema, ...rest } = repaired
        repaired = rest
        continue
      }
    }

    if (patched === schema) continue

    const { __addedDefs, ...schemaWithoutMarker } = patched
    log(`${tool.name}.${key}: injected $defs ${__addedDefs.join(', ')}`)
    repaired = { ...repaired, [key]: schemaWithoutMarker }
  }

  return repaired
}

function repairToolsList(message) {
  const tools = message?.result?.tools
  if (!Array.isArray(tools)) return message

  const pool = harvestDefs(tools)
  return {
    ...message,
    result: { ...message.result, tools: tools.map((tool) => repairTool(tool, pool)) },
  }
}

// ---------------------------------------------------------------------------
// HTTP transport
// ---------------------------------------------------------------------------

// The endpoint may answer as plain JSON or as a single SSE frame depending on
// the request, so accept both and read whichever arrived.
async function readBody(response) {
  const text = await response.text()
  if (text.trim() === '') return null

  const isEventStream = (response.headers.get('content-type') ?? '').includes('text/event-stream')
  if (!isEventStream) return JSON.parse(text)

  const payloads = text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .filter((line) => line !== '' && line !== '[DONE]')

  if (payloads.length === 0) return null
  return JSON.parse(payloads[payloads.length - 1])
}

async function forward(request) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'X-Goog-Api-Key': apiKey,
  }
  if (sessionId) headers['Mcp-Session-Id'] = sessionId

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const issued = response.headers.get('mcp-session-id')
  if (issued) sessionId = issued

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500)
    throw new Error(`HTTP ${response.status}: ${detail}`)
  }

  return readBody(response)
}

// ---------------------------------------------------------------------------
// stdio framing
// ---------------------------------------------------------------------------

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function errorFor(id, err) {
  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
  }
}

async function handle(line) {
  let request
  try {
    request = JSON.parse(line)
  } catch {
    log(`dropped unparseable line: ${line.slice(0, 200)}`)
    return
  }

  // Notifications carry no id and expect no reply. Forwarding still matters —
  // `notifications/initialized` completes the handshake server-side.
  const isNotification = request.id === undefined || request.id === null

  try {
    const response = await forward(request)
    if (isNotification || response === null) return
    send(request.method === 'tools/list' ? repairToolsList(response) : response)
  } catch (err) {
    log(`${request.method ?? 'unknown'} failed: ${err instanceof Error ? err.message : String(err)}`)
    // Without a reply the client waits on this id until its own timeout.
    if (!isNotification) send(errorFor(request.id, err))
  }
}

// Requests are handled as they arrive rather than serialised: JSON-RPC ids let
// the client match replies, and blocking on a slow screen generation would stall
// every later request behind it.
let buffer = ''

process.stdin.setEncoding('utf8')

process.stdin.on('data', (chunk) => {
  buffer += chunk

  let newline = buffer.indexOf('\n')
  while (newline !== -1) {
    const line = buffer.slice(0, newline).trim()
    buffer = buffer.slice(newline + 1)
    if (line !== '') void handle(line)
    newline = buffer.indexOf('\n')
  }
})

process.stdin.on('end', () => process.exit(0))
