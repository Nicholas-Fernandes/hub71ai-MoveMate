import { answerChat, extractProfile, generatePlan } from "../artifacts/api-server/src/lib/movemate";
import { answerWithMoveMate, isLunaEnabled } from "../artifacts/api-server/src/lib/luna-assistant";

type WorkerEnv = { OPENAI_API_KEY?: string };
type StaticAsset = { contentType: string; body: string };

// The build script replaces this token with the compiled Vite assets.
const staticAssets = JSON.parse("__MOVEMATE_ASSET_MAP__") as Record<string, StaticAsset>;
const decodedAssets = new Map<string, Uint8Array>();
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function decodeAsset(path: string, asset: StaticAsset) {
  const cached = decodedAssets.get(path);
  if (cached) return cached;
  const bytes = Uint8Array.from(atob(asset.body), character => character.charCodeAt(0));
  decodedAssets.set(path, bytes);
  return bytes;
}

async function handleApi(request: Request, env: WorkerEnv) {
  const { pathname } = new URL(request.url);
  if (request.method === "GET" && pathname === "/api/assistant-status") {
    const aiPowered = isLunaEnabled(env.OPENAI_API_KEY);
    return json({ aiPowered, model: aiPowered ? "gpt-6-luna" : null });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, any>;
  try {
    body = await request.json() as Record<string, any>;
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  if (pathname === "/api/extract-profile") {
    if (typeof body.text !== "string") return json({ error: "Profile text is required" }, 400);
    return json(extractProfile(body.text, body.answers));
  }
  if (pathname === "/api/generate-plan") {
    if (!body.profile || typeof body.profile !== "object") return json({ error: "A move profile is required" }, 400);
    return json(generatePlan(body.profile));
  }
  if (pathname === "/api/chat") {
    if (typeof body.message !== "string" || !body.profile || !body.plan || !Array.isArray(body.completedTaskIds)) {
      return json({ error: "A message, profile, plan, and completed task list are required" }, 400);
    }
    try {
      return json(await answerWithMoveMate(body as Parameters<typeof answerChat>[0], env.OPENAI_API_KEY));
    } catch {
      return json({ ...answerChat(body as Parameters<typeof answerChat>[0]), aiPowered: false });
    }
  }
  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: WorkerEnv) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });

    const requestedPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const assetPath = requestedPath && staticAssets[requestedPath] ? requestedPath : "index.html";
    const asset = staticAssets[assetPath];
    if (!asset) return new Response("Not found", { status: 404 });
    const headers = new Headers({
      "content-type": asset.contentType,
      "cache-control": assetPath === "index.html" ? "no-cache" : "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    });
    return new Response(request.method === "HEAD" ? null : decodeAsset(assetPath, asset), { headers });
  },
};
