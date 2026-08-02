# Push notifications — the contract for the mobile app

The backend half is built and deployed. This is what the mobile app has to do,
and what it can rely on.

Everything below is authenticated as a **business operator** — the same bearer
token the app already stores under `xtiitch.business.session.v1`. There is no
customer-side push yet.

---

## 1. Register a device

```
POST /v1/notifications/devices
Authorization: Bearer <business access token>
Content-Type: application/json

{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios",              // optional: "ios" | "android" | "web" | ""
  "device_name": "Ama's iPhone"   // optional, label only, trimmed to 120 chars
}
```

```json
200 OK
{
  "device": {
    "token_id": "…", "token": "ExponentPushToken[…]",
    "platform": "ios", "device_name": "Ama's iPhone",
    "last_seen_at": "2026-08-02T09:14:00Z", "created_at": "2026-08-02T09:14:00Z"
  }
}
```

**Call this on every launch**, not once. Expo can reissue a token at any time,
and re-registering is a cheap upsert — the same device never produces a second
row. `last_seen_at` moves forward each time.

Errors: `400 invalid_push_token` (not an Expo token), `400 invalid_push_platform`,
`401 invalid_token`.

## 2. Unregister on sign-out

```
POST /v1/notifications/devices/unregister
{ "token": "ExponentPushToken[…]" }
→ 204 No Content
```

A `POST`, not a `DELETE`, so the token travels in a body rather than a URL —
request URLs land in access logs, and a push token is a capability. Unregistering
an unknown token also returns 204; that is deliberate, so the endpoint cannot be
used to probe whether a token is on file.

**Do call this at sign-out.** If you skip it, the device keeps receiving that
business's orders until someone signs in again on the same phone.

## 3. List the operator's devices

```
GET /v1/notifications/devices
→ { "devices": [ { …same shape as above… } ] }
```

Scoped to the signed-in operator, not the business — a settings screen must not
list colleagues' phones. The `token` is echoed so you can mark which row is the
phone in the user's hand.

---

## What arrives

One notification per registered device, when an order is **paid for**:

```json
{
  "title": "New order",
  "body": "Ama Boateng · Kente wrap dress · GH₵250.00",
  "sound": "default",
  "priority": "high",
  "channelId": "orders",
  "data": {
    "kind": "new_order_owner_push",
    "order_id": "…",
    "message_id": "…"
  }
}
```

Two things the app must do for this to work properly:

**Create an Android channel called `orders`.** Android silently downgrades a
notification whose channel does not exist — it will arrive without sound and
without a heads-up banner, which looks exactly like a backend bug.

**Deep-link on `data.order_id`.** Opening the order the notification is about is
the entire point; dropping the user on a dashboard wastes the alert.

Missing fields are omitted rather than sent empty — a bespoke order has no price
yet, so `body` may be just the customer's name.

---

## Things that will bite you if you assume otherwise

**Registration is per (device, business).** Registering moves the device to the
signing-in operator, including across businesses. That is intentional: a phone
that changes hands must stop receiving the previous business's alerts, which name
the customer and the amount.

**A dead token is deleted, not disabled.** When Expo reports `DeviceNotRegistered`
— app uninstalled, token reissued — the backend removes the row on the spot. The
app re-registers itself on the next launch, so there is nothing to do about this
except keep calling register on launch.

**Push does not require Expo credentials.** It works as soon as the worker
deploys. `EXPO_ACCESS_TOKEN` stays unset unless the Expo project turns on
enhanced security.

**Expo Go cannot receive push on a real build.** Remote push needs a development
or production build with the project's FCM/APNs credentials configured. Testing
in Expo Go will look like the backend is silent.

**Only paid orders push.** The alert is enqueued inside the payment settlement
transaction, so a draft or abandoned checkout produces nothing.

---

## Delivery guarantees

Push rides the same transactional outbox as SMS, so it inherits what that gives:

- **Enqueued in the settlement transaction.** If the payment commits, the
  notification exists; if it rolls back, nothing was queued.
- **Deduplicated per (order, device).** A redelivered Paystack webhook — routine,
  not exceptional — adds nothing.
- **Retried with exponential backoff**, five attempts, then dead-lettered.
- **Except when retrying is pointless.** A gone device, a message Expo refuses as
  malformed, or a credentials mismatch is terminal on the first attempt rather
  than burning an hour of backoff.

Delivery is best-effort after that: Expo returning a ticket means Expo accepted
the message, not that the phone displayed it. SMS and email remain the channels
that guarantee the owner hears about an order.
