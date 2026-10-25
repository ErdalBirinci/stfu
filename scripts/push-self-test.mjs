// Self-test for the push pipeline pieces that live outside the browser:
//   1. RFC 8291 payload encryption round-trips through a simulated receiver.
//   2. The VAPID JWT verifies against its own public key.
//   3. The service worker turns a push payload into the right notification and
//      opens the right page when that notification is tapped.
//
// Run with: node scripts/push-self-test.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import {
  encryptPayload,
  vapidAuthorization,
  describeNotification,
} from '../supabase/functions/push/index.ts'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
const hmac = async (key, data) =>
  new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
      data,
    ),
  )
const b64u = (bytes) => Buffer.from(new Uint8Array(bytes)).toString('base64url')

/* ---------------------------------------------- 1. payload encryption */

const receiver = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
  'deriveBits',
])
const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', receiver.publicKey))
const authSecret = crypto.getRandomValues(new Uint8Array(16))
const payload = JSON.stringify({ title: 'Özlem replied', body: 'Merhaba! 👋', url: 'post/1' })

const { body } = await encryptPayload(payload, b64u(uaPublic), b64u(authSecret))

const salt = body.slice(0, 16)
const recordSize = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0)
const idLength = body[20]
const senderPublic = body.slice(21, 21 + idLength)
const cipher = body.slice(21 + idLength)

assert.equal(recordSize, 4096, 'record size must be 4096')
assert.equal(idLength, 65, 'sender key must be an uncompressed P-256 point')

const senderKey = await crypto.subtle.importKey(
  'raw',
  senderPublic,
  { name: 'ECDH', namedCurve: 'P-256' },
  false,
  [],
)
const shared = new Uint8Array(
  await crypto.subtle.deriveBits({ name: 'ECDH', public: senderKey }, receiver.privateKey, 256),
)
const prkKey = await hmac(authSecret, shared)
const ikm = await hmac(
  prkKey,
  cat(encoder.encode('WebPush: info\0'), uaPublic, senderPublic, new Uint8Array([1])),
)
const prk = await hmac(salt, ikm)
const contentKey = (await hmac(prk, cat(encoder.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16)
const nonce = (await hmac(prk, cat(encoder.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)
const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['decrypt'])
const plain = new Uint8Array(
  await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, cipher),
)

assert.equal(plain[plain.length - 1], 2, 'payload must end with the last-record marker')
assert.equal(decoder.decode(plain.slice(0, -1)), payload, 'decrypted payload must match')

/* --------------------------------------------------------- 2. VAPID */

const signing = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])
const jwk = await crypto.subtle.exportKey('jwk', signing.privateKey)
const publicKey = `B${Buffer.concat([
  Buffer.from(jwk.x, 'base64url'),
  Buffer.from(jwk.y, 'base64url'),
]).toString('base64url')}`

const header = await vapidAuthorization(
  'https://fcm.googleapis.com/fcm/send/example',
  { publicKey, jwk },
  'mailto:test@example.com',
)
const [, token, keyParam] = header.match(/^vapid t=([^,]+), k=(.+)$/)
assert.equal(keyParam, publicKey, 'k= must carry the VAPID public key')

const [jwtHeader, jwtClaims, jwtSignature] = token.split('.')
const verifier = await crypto.subtle.importKey(
  'raw',
  Uint8Array.from(
    Buffer.from(
      `04${Buffer.from(jwk.x, 'base64url').toString('hex')}${Buffer.from(jwk.y, 'base64url').toString('hex')}`,
      'hex',
    ),
  ),
  { name: 'ECDSA', namedCurve: 'P-256' },
  false,
  ['verify'],
)
assert.ok(
  await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    verifier,
    new Uint8Array(Buffer.from(jwtSignature, 'base64url')),
    encoder.encode(`${jwtHeader}.${jwtClaims}`),
  ),
  'VAPID signature must verify',
)
const claims = JSON.parse(Buffer.from(jwtClaims, 'base64url').toString())
assert.equal(claims.aud, 'https://fcm.googleapis.com')
assert.ok(claims.exp > Math.floor(Date.now() / 1000), 'token must not be expired')

/* ------------------------------------------------------ 3. service worker */

const scope = 'https://erdalbirinci.github.io/stfu/'
const listeners = {}
const shown = []
const opened = []
const navigated = []
const clients = [
  {
    url: `${scope}profile`,
    focus: async () => {},
    navigate: async (url) => navigated.push(url),
  },
]

const swSelf = {
  registration: {
    scope,
    showNotification: async (title, options) => shown.push({ title, options }),
  },
  location: { hostname: 'erdalbirinci.github.io' },
  addEventListener: (type, handler) => {
    listeners[type] = listeners[type] || []
    listeners[type].push(handler)
  },
  skipWaiting() {},
  clients: {
    claim: async () => {},
    matchAll: async () => clients,
    openWindow: async (url) => opened.push(url),
  },
}

new Function('self', 'caches', 'Response', readFileSync('public/sw.js', 'utf8'))(
  swSelf,
  { open: async () => ({}), keys: async () => [], delete: async () => true },
  Response,
)

const pending = []
listeners.push[0]({
  data: {
    json: () => ({ title: 'Özlem replied', body: 'Merhaba', url: 'post/abc', tag: 'post-abc' }),
    text: () => '',
  },
  waitUntil: (promise) => pending.push(promise),
})
await Promise.all(pending)

assert.equal(shown.length, 1, 'one notification per push')
assert.equal(shown[0].title, 'Özlem replied')
assert.equal(shown[0].options.body, 'Merhaba')
assert.equal(shown[0].options.tag, 'post-abc')
assert.equal(shown[0].options.icon, `${scope}icons/icon-192.png`)
assert.equal(shown[0].options.data.url, `${scope}post/abc`, 'relative url resolves inside the app')

const clicks = []
listeners.notificationclick[0]({
  notification: {
    close() {},
    data: { url: `${scope}post/abc` },
  },
  waitUntil: (promise) => clicks.push(promise),
})
await Promise.all(clicks)
assert.equal(navigated[0], `${scope}post/abc`, 'tapping focuses the open app on that post')
assert.equal(opened.length, 0, 'an open window is reused instead of a new one')

/* ------------------------------------------------------------ 4. copy */

const reply = describeNotification({
  id: '1',
  user_id: 'u',
  kind: 'comment',
  entity_id: 'c1',
  post_id: 'p1',
  memory_id: null,
  body: 'harika',
  actor: { display_name: 'Özlem' },
})
assert.equal(reply.title, 'Özlem replied')
assert.equal(reply.url, 'post/p1')

const memory = describeNotification({
  id: '2',
  user_id: 'u',
  kind: 'comment',
  entity_id: 'c2',
  post_id: null,
  memory_id: 'm1',
  body: 'ne güzel',
  actor: { display_name: 'Dobby' },
})
assert.equal(memory.url, 'memories/m1#comments')

const withPhotos = describeNotification(
  {
    id: '3',
    user_id: 'u',
    kind: 'post',
    entity_id: 'p2',
    post_id: 'p2',
    memory_id: null,
    body: 'Boat day',
    actor: { display_name: 'Juulia' },
  },
  { media: { images: 2, videos: 1, audios: 0 } },
)
assert.equal(withPhotos.title, 'Juulia posted')
assert.equal(withPhotos.body, '“Boat day” · 2 photos and 1 video')

const mention = describeNotification({
  id: '4',
  user_id: 'u',
  kind: 'mention',
  entity_id: 'c4',
  post_id: 'p4',
  memory_id: null,
  body: 'hey @Dobby look at this',
  actor: { display_name: 'Özlem' },
})
assert.equal(mention.title, 'Özlem mentioned you')
assert.equal(mention.body, '“hey @Dobby look at this”')

const planned = describeNotification(
  {
    id: '5',
    user_id: 'u',
    kind: 'event',
    entity_id: 'e1',
    post_id: null,
    memory_id: null,
    body: 'Dinner',
    actor: { display_name: 'Dobby' },
  },
  {
    event: {
      title: 'Dinner',
      starts_at: new Date(Date.now() + 3 * 3600_000).toISOString(),
      location: 'Kadıköy',
    },
  },
)
assert.equal(planned.title, 'Dobby planned “Dinner”')
assert.equal(planned.body, 'starts in 3 hours · Kadıköy')

console.log('push self-test: all assertions passed')
