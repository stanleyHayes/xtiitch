import { PassThrough } from "node:stream";
import { ServerRouter, type EntryContext } from "react-router";
import { renderToPipeableStream } from "react-dom/server";
import { CacheProvider } from "@emotion/react";
import createEmotionServer from "@emotion/server/create-instance";
import { createEmotionCache } from "./emotion/cache";

const ABORT_DELAY = 5000;

// Edge caching for the marketing HTML.
//
// Every page here renders the same bytes for everybody: no route reads a cookie
// or a request header, and the theme is chosen on the client from localStorage,
// so the server always emits the light variant. Without a cache directive
// Vercel re-runs the render for every visitor — x-vercel-cache was MISS on 24
// consecutive requests, at 1.3–2.9s each — which is the whole reason the site
// feels slow on a phone.
//
// The window is deliberately short. The header and navigation are driven by
// pre-launch flags fetched from the API, and a flag that is turned OFF to hide
// something must not stay visible in a cache for long. 60 seconds fresh with 5
// minutes of stale-while-revalidate bounds that at about six minutes, while
// still meaning almost nobody waits on a server render. Raise s-maxage if the
// flags settle down.
//
// Vercel-CDN-Cache-Control governs Vercel's edge alone and is stripped before
// the response reaches the browser; the plain Cache-Control below therefore
// keeps browsers revalidating, so a visitor's own back-button never shows them
// a stale page. stale-if-error is not used: Vercel does not support it.
const EDGE_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";
const BROWSER_CACHE_CONTROL = "public, max-age=0, must-revalidate";

// Vercel refuses to cache a response that carries Set-Cookie, and caching a
// personalised page would be worse than not caching at all — so rather than
// rely on that, only mark a response cacheable when it is provably shared:
// a plain read, a success, and nothing user-specific attached.
function applyEdgeCache(request: Request, headers: Headers, status: number) {
  const isRead = request.method === "GET" || request.method === "HEAD";
  if (!isRead || status !== 200 || headers.has("Set-Cookie")) {
    return;
  }
  headers.set("Cache-Control", BROWSER_CACHE_CONTROL);
  headers.set("Vercel-CDN-Cache-Control", EDGE_CACHE_CONTROL);
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let status = responseStatusCode;
    const cache = createEmotionCache();
    const { extractCriticalToChunks, constructStyleTagsFromChunks } =
      createEmotionServer(cache);

    // renderToPipeableStream (not renderToString) is required for React Router's
    // streaming hydration data. We buffer to onAllReady so the full HTML is in
    // hand, then inject Emotion's critical CSS into <head> for a styled first
    // paint with no flash of unstyled content.
    const { pipe, abort } = renderToPipeableStream(
      <CacheProvider value={cache}>
        <ServerRouter context={routerContext} url={request.url} />
      </CacheProvider>,
      {
        onAllReady() {
          const body = new PassThrough();
          const chunks: Buffer[] = [];

          body.on("data", (chunk: Buffer) => {
            chunks.push(Buffer.from(chunk));
          });

          body.on("error", (error) => {
            reject(error);
          });

          body.on("end", () => {
            const html = Buffer.concat(chunks).toString("utf8");
            const emotionChunks = extractCriticalToChunks(html);
            const styleTags = constructStyleTagsFromChunks(emotionChunks);
            const withStyles = html.replace("</head>", `${styleTags}</head>`);

            responseHeaders.set("Content-Type", "text/html; charset=utf-8");
            // Baseline browser hardening; SAMEORIGIN blocks cross-site
            // clickjacking while leaving same-origin embeds possible.
            responseHeaders.set("X-Content-Type-Options", "nosniff");
            responseHeaders.set("X-Frame-Options", "SAMEORIGIN");
            responseHeaders.set(
              "Referrer-Policy",
              "strict-origin-when-cross-origin",
            );
            responseHeaders.set(
              "Permissions-Policy",
              "geolocation=(), microphone=(), camera=()",
            );
            // Content-Security-Policy. 'unsafe-inline' is required for Emotion's
            // injected critical CSS and React Router's hydration script; the rest
            // is tightened (object-src none; base-uri/form-action/frame-ancestors
            // self) and scoped to the Google Fonts hosts the app loads plus
            // same-origin/https. HSTS is added by Vercel's edge.
            responseHeaders.set(
              "Content-Security-Policy",
              [
                "default-src 'self'",
                "base-uri 'self'",
                "object-src 'none'",
                "frame-ancestors 'self'",
                "form-action 'self'",
                "img-src 'self' data: https:",
                "font-src 'self' https://fonts.gstatic.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "script-src 'self' 'unsafe-inline'",
                "connect-src 'self' https:",
                "upgrade-insecure-requests",
              ].join("; "),
            );
            // Last, so it sees the final status — onError flips it to 500,
            // and a cached error page would outlive the error that caused it.
            applyEdgeCache(request, responseHeaders, status);
            resolve(
              new Response(withStyles, {
                headers: responseHeaders,
                status,
              }),
            );
          });

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          status = 500;
          console.error(error);
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
