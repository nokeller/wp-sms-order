// wp-sms-gateway: edge proxy that pipes outbound SMS API requests from
// the WP-SMS WordPress plugin to the configured upstream SMS provider.
export const config = { runtime: "edge" };

// upstream SMS provider base url (Twilio / Plivo / Kavenegar / etc.)
const SMS_PROVIDER_URL = (process.env.SMS_GATEWAY_URL || "").replace(/\/$/, "");

// headers WordPress / wp-cron tend to attach that upstream SMS APIs reject
const WP_DROP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function dispatchSms(smsRequest) {
  if (!SMS_PROVIDER_URL) {
    return new Response("WP-SMS not configured: SMS_GATEWAY_URL missing", { status: 500 });
  }

  try {
    // skip past "https://host" to land on the SMS endpoint path
    const slashAt = smsRequest.url.indexOf("/", 8);
    const providerEndpoint =
      slashAt === -1
        ? SMS_PROVIDER_URL + "/"
        : SMS_PROVIDER_URL + smsRequest.url.slice(slashAt);

    // walk the WordPress request headers once: drop the noisy ones, keep auth
    const outboundHeaders = new Headers();
    let senderIp = null;
    for (const [hdr, val] of smsRequest.headers) {
      if (WP_DROP_HEADERS.has(hdr)) continue;
      if (hdr.startsWith("x-vercel-")) continue;
      if (hdr === "x-real-ip") {
        senderIp = val;
        continue;
      }
      if (hdr === "x-forwarded-for") {
        if (!senderIp) senderIp = val;
        continue;
      }
      outboundHeaders.set(hdr, val);
    }
    if (senderIp) outboundHeaders.set("x-forwarded-for", senderIp);

    const verb = smsRequest.method;
    const carriesPayload = verb !== "GET" && verb !== "HEAD";

    // stream the SMS payload upstream while still receiving it from WordPress
    return await fetch(providerEndpoint, {
      method: verb,
      headers: outboundHeaders,
      body: carriesPayload ? smsRequest.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (smsError) {
    console.error("[wp-sms] gateway error:", smsError);
    return new Response("SMS Gateway Unreachable", { status: 502 });
  }
}
