/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  GOOGLE_CLIENT_ID?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/google/config") {
      return Response.json({ clientId: env.GOOGLE_CLIENT_ID || "" }, { headers: { "Cache-Control": "no-store" } });
    }

    // Notion and Slack refuse browser calls, so forward them from the worker.
    // Upstreams are allowlisted; the caller's key is passed through per request
    // and is never stored, logged, or read here.
    if (url.pathname === "/api/connector" && request.method === "POST") {
      const upstreams: Record<string, string> = { notion: "https://api.notion.com", slack: "https://slack.com" };
      const base = upstreams[request.headers.get("x-relay-provider") || ""];
      const path = request.headers.get("x-relay-path") || "";
      const key = request.headers.get("x-relay-key") || "";
      if (!base || !key || !/^\/[A-Za-z0-9/._-]*$/.test(path)) return new Response("Bad connector request", { status: 400 });
      const target = new URL(path, base);
      if (target.origin !== base) return new Response("Bad connector path", { status: 400 });
      // The edge runtime rejects redirect:"error", so follow nothing manually
      // and refuse any 3xx rather than replaying the key to a new location.
      const upstream = await fetch(target, {
        method: "POST",
        redirect: "manual",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          ...(base.includes("notion") ? { "Notion-Version": "2022-06-28" } : {}),
        },
        body: await request.text(),
      });
      if (upstream.status >= 300 && upstream.status < 400) return new Response("Upstream redirect refused", { status: 502 });
      return upstream;
    }

    if (url.pathname === "/api/auth/config") {
      return Response.json(
        { url: env.SUPABASE_URL || "", publishableKey: env.SUPABASE_PUBLISHABLE_KEY || "" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
