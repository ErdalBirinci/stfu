// Supabase Edge Function: deliver a web push for one notification row.
//
// The database calls this after every notification insert. It reads the
// member's devices, encrypts one message per device (RFC 8291, aes128gcm) and
// signs a VAPID token (RFC 8292) with Web Crypto alone — no dependencies.
//
// Secrets: PUSH_WEBHOOK_SECRET, VAPID_PRIVATE_JWK, VAPID_PUBLIC_KEY, PUSH_SUBJECT
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come from the platform.
//
// Deployed with the dashboard editor ("Via Editor"), so everything lives in this
// one file. The crypto helpers are exported so scripts/push-self-test.mjs can
// exercise them under Node.

const encoder = new TextEncoder()

type DenoLike = {
  env?: { get: (key: string) => string | undefined }
  serve?: (handler: (request: Request) => Promise<Response>) => void
}

const runtime = (globalThis as { Deno?: DenoLike }).Deno
const env = (name: string) => runtime?.env?.get?.(name) ?? ''

const SUPABASE_URL = env('SUPABASE_URL')

// Newer projects hand out SUPABASE_SECRET_KEYS instead of a service role JWT;
// either one works for server-side REST calls that bypass RLS.
const SERVICE_KEY = (() => {
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>
    return Object.values(keys)[0] ?? ''
  } catch {
    return ''
  }
})()
const WEBHOOK_SECRET = env('PUSH_WEBHOOK_SECRET')
const PUBLIC_KEY = env('VAPID_PUBLIC_KEY')
const SUBJECT = env('PUSH_SUBJECT') || env('VAPID_SUBJECT') || 'mailto:hello@example.com'

const PRIVATE_JWK: { x?: string; y?: string; d?: string } = (() => {
  try {
    return JSON.parse(env('VAPID_PRIVATE_JWK') || '{}')
  } catch {
    return {}
  }
})()

/* ------------------------------------------------------------------ base64 */

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/* --------------------------------------------------------------- web crypto */

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data as unknown as BufferSource))
}

async function hkdf(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const block = await hmac(prk, concat(info, new Uint8Array([1])))
  return block.slice(0, length)
}

/** Encrypts one aes128gcm record and returns the request body for a push endpoint. */
export async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string,
): Promise<{ body: Uint8Array; publicKey: Uint8Array; salt: Uint8Array }> {
  const uaPublic = fromBase64Url(p256dh)
  const authSecret = fromBase64Url(auth)

  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey))
  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic as unknown as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, ephemeral.privateKey, 256),
  )

  // PRK_key = HMAC(auth, ecdh); IKM = HMAC(PRK_key, "WebPush: info" 0x00 ua as 0x01)
  const prkKey = await hmac(authSecret, shared)
  const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1]))
  const ikm = await hmac(prkKey, keyInfo)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmac(salt, ikm)
  const contentKey = await hkdf(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(prk, encoder.encode('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey(
    'raw',
    contentKey as unknown as BufferSource,
    'AES-GCM',
    false,
    ['encrypt'],
  )
  const record = concat(encoder.encode(payload), new Uint8Array([0x02]))
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as unknown as BufferSource, tagLength: 128 },
      aesKey,
      record as unknown as BufferSource,
    ),
  )

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = asPublic.length
  header.set(asPublic, 21)

  return { body: concat(header, cipher), publicKey: asPublic, salt }
}

/** Builds the Authorization header for a push endpoint (RFC 8292, ES256). */
export async function vapidAuthorization(
  endpoint: string,
  keys: { publicKey: string; jwk: { x: string; y: string; d: string } },
  subject: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: keys.jwk.x, y: keys.jwk.y, d: keys.jwk.d, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = toBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  )
  const unsigned = `${header}.${claims}`
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned)),
  )

  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${keys.publicKey}`
}

/* ------------------------------------------------------------------- copy */

interface NotificationRow {
  id: string
  user_id: string
  kind: string
  entity_id: string | null
  post_id: string | null
  memory_id: string | null
  body: string | null
  actor: { display_name: string } | null
}

export function describeNotification(row: NotificationRow): {
  title: string
  body: string
  url: string
  tag: string
} {
  const name = row.actor?.display_name ?? 'Someone'
  const quoted = row.body ? `“${row.body.slice(0, 90)}”` : ''

  switch (row.kind) {
    case 'post':
      return {
        title: `${name} posted in STFU`,
        body: row.body ? row.body.slice(0, 120) : 'Something new in the circle.',
        url: row.post_id ? `post/${row.post_id}` : '',
        tag: row.post_id ? `post-${row.post_id}` : 'post',
      }
    case 'comment':
      return row.memory_id
        ? {
            title: `${name} commented on a memory`,
            body: row.body ? row.body.slice(0, 120) : 'A memory got a reply.',
            url: `memories/${row.memory_id}#comments`,
            tag: `memory-${row.memory_id}`,
          }
        : {
            title: `${name} replied`,
            body: row.body ? row.body.slice(0, 120) : 'Your post has a new reply.',
            url: row.post_id ? `post/${row.post_id}` : '',
            tag: row.post_id ? `post-${row.post_id}` : 'comment',
          }
    case 'reaction':
      return {
        title: `${name} reacted to your post`,
        body: row.body ? `A ${row.body} on your post.` : 'Someone liked what you shared.',
        url: row.post_id ? `post/${row.post_id}` : '',
        tag: row.post_id ? `post-${row.post_id}` : 'reaction',
      }
    case 'event':
      return {
        title: 'New plan in the circle',
        body: quoted ? `${name} planned ${quoted}` : `${name} planned an event.`,
        url: row.entity_id ? `events/${row.entity_id}` : 'calendar',
        tag: row.entity_id ? `event-${row.entity_id}` : 'event',
      }
    case 'memory':
      return {
        title: 'A new memory',
        body: quoted ? `${name} added ${quoted}` : `${name} added a memory.`,
        url: row.entity_id ? `memories/${row.entity_id}` : 'memories',
        tag: row.entity_id ? `memory-${row.entity_id}` : 'memory',
      }
    case 'test':
      return {
        title: 'STFU is working',
        body: row.body ? row.body.slice(0, 120) : 'This device can receive notifications.',
        url: 'profile',
        tag: 'push-test',
      }
    case 'reminder':
      return {
        title: 'Starting within a day',
        body: row.body ? `${row.body} — it starts soon.` : 'An event starts soon.',
        url: row.entity_id ? `events/${row.entity_id}` : 'calendar',
        tag: row.entity_id ? `reminder-${row.entity_id}` : 'reminder',
      }
    default:
      return { title: 'STFU', body: 'Something new in the circle.', url: '', tag: 'stfu' }
  }
}

/* ------------------------------------------------------------------- REST */

interface Subscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function restHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function getNotification(id: string): Promise<NotificationRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}&select=id,user_id,kind,entity_id,post_id,memory_id,body,actor:profiles!notifications_actor_id_fkey(display_name)`,
    { headers: restHeaders() },
  )
  if (!response.ok) throw new Error(`notification lookup failed: ${response.status}`)
  const rows = (await response.json()) as NotificationRow[]
  return rows[0] ?? null
}

async function getSubscriptions(userId: string): Promise<Subscription[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=id,endpoint,p256dh,auth`,
    { headers: restHeaders() },
  )
  if (!response.ok) throw new Error(`subscription lookup failed: ${response.status}`)
  return (await response.json()) as Subscription[]
}

async function updateSubscription(id: string, patch: Record<string, string | null>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${id}`, {
    method: 'PATCH',
    headers: restHeaders(),
    body: JSON.stringify(patch),
  })
}

async function deleteSubscription(id: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${id}`, {
    method: 'DELETE',
    headers: restHeaders(),
  })
}

/* ---------------------------------------------------------------- handler */

async function handle(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!WEBHOOK_SECRET || request.headers.get('x-push-secret') !== WEBHOOK_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }

  let notificationId = ''
  try {
    const body = await request.json()
    notificationId = body?.notification_id ?? ''
  } catch {
    return json({ error: 'bad body' }, 400)
  }
  if (!notificationId) return json({ error: 'notification_id required' }, 400)

  try {
    const notification = await getNotification(notificationId)
    if (!notification) return json({ ok: true, sent: 0, note: 'notification gone' })

    const devices = await getSubscriptions(notification.user_id)
    if (devices.length === 0) return json({ ok: true, sent: 0, note: 'no devices' })

    const payload = JSON.stringify(describeNotification(notification))

    let sent = 0
    const failures: string[] = []

    for (const device of devices) {
      try {
        const { body } = await encryptPayload(payload, device.p256dh, device.auth)
        const authorization = await vapidAuthorization(
          device.endpoint,
          { publicKey: PUBLIC_KEY, jwk: PRIVATE_JWK as { x: string; y: string; d: string } },
          SUBJECT,
        )

        const response = await fetch(device.endpoint, {
          method: 'POST',
          headers: {
            Authorization: authorization,
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            TTL: '86400',
            Urgency: notification.kind === 'reminder' ? 'high' : 'normal',
          },
          body: body as unknown as BodyInit,
        })

        if (response.status >= 200 && response.status < 300) {
          sent += 1
          await updateSubscription(device.id, {
            last_success_at: new Date().toISOString(),
            failed_at: null,
          })
        } else if (response.status === 404 || response.status === 410) {
          await deleteSubscription(device.id)
          failures.push(`${response.status} gone`)
        } else {
          const text = await response.text()
          failures.push(`${response.status} ${text.slice(0, 160)}`)
          await updateSubscription(device.id, { failed_at: new Date().toISOString() })
        }
      } catch (error) {
        failures.push(error instanceof Error ? error.message : 'unknown push failure')
      }
    }

    return json({ ok: true, sent, failed: failures.length, failures })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'push failed' }, 500)
  }
}

// Only Deno serves; Node imports this file for the crypto self-test.
if (runtime?.serve) runtime.serve(handle)
