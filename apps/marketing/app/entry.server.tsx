import { PassThrough } from "node:stream";
import { ServerRouter, type EntryContext } from "react-router";
import { renderToPipeableStream } from "react-dom/server";
import { CacheProvider } from "@emotion/react";
import createEmotionServer from "@emotion/server/create-instance";
import { createEmotionCache } from "./emotion/cache";

const ABORT_DELAY = 5000;

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
