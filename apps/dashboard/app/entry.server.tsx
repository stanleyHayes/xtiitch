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
