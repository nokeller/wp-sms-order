=== WP-SMS Gateway ===
Contributors: wpsmsgateway
Tags: sms, wp-sms, gateway, twilio, plivo, kavenegar, notifications, woocommerce
Requires at least: 5.8
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Lightweight edge gateway proxy for the **WP-SMS** WordPress plugin. Routes
outbound SMS API requests through a globally-distributed Vercel Edge
Function before they reach your SMS provider (Twilio, Plivo, Kavenegar,
SMS.ir, MessageBird, Vonage, etc.).

== Description ==

**WP-SMS Gateway** is a thin proxy companion for the popular
[WP-SMS](https://wordpress.org/plugins/wp-sms/) WordPress plugin. Instead
of letting WordPress hit your SMS provider directly from a single origin
IP, this gateway sits in front of the provider and forwards every SMS API
call from the WP-SMS plugin through Vercel's edge network.

= Why would I want this? =

* **Origin IP isolation.** Your WordPress server's IP is never exposed to
  the SMS provider — the request lands at Vercel first.
* **Lower latency for international SMS.** Vercel's anycast edge picks the
  closest PoP to the SMS provider, not your WP host.
* **Centralised auth + rate limiting.** Strip WordPress-specific headers,
  attach the right `Authorization` header server-side, throttle in one
  place instead of in every plugin install.
* **WooCommerce-friendly.** Order confirmations, OTPs, abandoned-cart
  reminders all flow through the same hardened endpoint.

= How it works =

```
┌──────────────────┐     HTTPS     ┌──────────────────┐    HTTPS    ┌──────────────────┐
│ WordPress site   │ ────────────► │  Vercel Edge     │ ──────────► │  SMS provider    │
│ (WP-SMS plugin)  │  SMS API call │  (sms-gateway)   │  forwarded  │  (Twilio, etc.)  │
└──────────────────┘               └──────────────────┘             └──────────────────┘
```

1. The WP-SMS plugin builds an SMS API request as usual.
2. You point its **API endpoint** at your Vercel deployment URL instead
   of the provider's hostname.
3. The edge function strips noisy WordPress / hop-by-hop headers, keeps
   the `Authorization` header intact, and streams the request body to
   your real SMS provider.
4. The provider's response streams straight back to WordPress.

== Installation ==

= 1. Requirements =

* The [WP-SMS](https://wordpress.org/plugins/wp-sms/) plugin already
  installed and activated on your WordPress site.
* An account with any HTTP-based SMS provider (Twilio, Plivo, Kavenegar,
  SMS.ir, MessageBird, Vonage, ClickSend, etc.).
* A free or Pro [Vercel](https://vercel.com) account.
* The [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`.

= 2. Configure the gateway URL =

In the Vercel Dashboard → your project → **Settings → Environment
Variables**, add:

| Name              | Example                       | Description                                       |
| ----------------- | ----------------------------- | ------------------------------------------------- |
| `SMS_GATEWAY_URL` | `https://api.twilio.com`      | Full origin URL of your SMS provider's REST API. |

Notes:

* Use `https://` for any modern SMS provider.
* Include a non-default port if your provider needs one.
* Trailing slashes are trimmed automatically.

= 3. Deploy =

```bash
git clone https://github.com/YOUR-USER/wp-sms-gateway.git
cd wp-sms-gateway

vercel --prod
```

Vercel returns a deployment URL like `your-sms.vercel.app` once the
build finishes.

= 4. Point WP-SMS at the gateway =

In WordPress admin → **WP SMS → Settings → Webservice / Gateway**, set
the API endpoint to your Vercel deployment URL (e.g.
`https://your-sms.vercel.app`). Keep your provider username, API token,
and sender ID exactly as they were — the gateway forwards them through
unchanged.

== Frequently Asked Questions ==

= Does this replace the WP-SMS plugin? =

No. WP-SMS still composes the SMS payload, manages the subscriber list,
and renders the admin UI. This project only forwards the outbound HTTP
call to the provider.

= Which SMS providers are supported? =

Any HTTP/HTTPS-based provider. The gateway is transport-agnostic — it
forwards method, headers, and body verbatim. Tested with Twilio, Plivo,
Kavenegar, SMS.ir, and MessageBird.

= Will this work with WooCommerce SMS notifications? =

Yes. WooCommerce delegates SMS sending to WP-SMS, so any traffic that
goes through WP-SMS automatically goes through the gateway.

= Does the gateway store SMS content? =

No. There is **no** persistent storage. Each request streams through the
edge function and is forwarded to the provider. Vercel logs request
metadata (path, IP, status) but does not log the body.

= Is this an official WP-SMS plugin product? =

No. This is an independent, community-built helper. Use at your own
risk.

== Performance notes ==

The handler is intentionally written for sustained throughput:

* `SMS_GATEWAY_URL` is read **once at cold start** and parked at module
  scope — zero env lookups per request.
* URL parsing is skipped on the hot path — the path+query is sliced out
  of `req.url` directly without ever allocating a `URL` object.
* Headers are filtered in a **single sweep**: hop-by-hop names
  (`connection`, `keep-alive`, `transfer-encoding`, …), Vercel telemetry
  (`x-vercel-*`), and Vercel-edge `x-forwarded-host/proto/port` are all
  dropped. The original sender IP (`x-real-ip` or `x-forwarded-for`) is
  re-emitted as `x-forwarded-for` so your provider's audit logs stay
  meaningful.
* `fetch(endpoint, options)` is called directly — no extra
  `new Request(...)` allocation.
* `redirect: "manual"` keeps Vercel from chasing 3xx responses upstream
  and confusing the WP-SMS plugin's response handler.

== Disclaimer ==

**This is not production-grade software.** It is provided as a personal
utility under GPLv2: no SLA, no security audit, no maintenance promise,
no support channel.

* **Compliance is your responsibility.** SMS regulations (TCPA, GDPR,
  CTIA short-code rules, country-specific consent laws) vary widely. The
  authors and contributors are not responsible for how you use this
  code.
* **Vercel's terms of service** apply to anything you run on their
  platform — read them yourself.
* **No warranty.** The software is provided "as is", express or implied.

== Project Layout ==

```
.
├── api/sms-gateway.js   # Edge function: streams WP-SMS request → provider, streams response back
├── package.json         # Project metadata (no runtime deps; fetch/Headers are globals)
├── vercel.json          # Routes all paths → /api/sms-gateway
└── README.md
```

== Changelog ==

= 1.0.0 =
* Initial public release.
* Edge-runtime SMS gateway proxy.
* Single-pass header filtering.
* Streaming request/response.

== License ==

GPL-2.0-or-later, matching the WP-SMS plugin.
