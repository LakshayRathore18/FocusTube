import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer, preview } from "vite";

// An isolated HTTP check: no FastAPI configuration, database or providers.
const backend = createHttpServer(async (request, response) => {
  if (request.url.startsWith("/api/auth/callback/google")) {
    response.writeHead(303, {
      Location: "/dashboard",
      "Set-Cookie": ["test_session=opaque; HttpOnly; SameSite=Lax; Path=/", "test_oauth=; Max-Age=0; Path=/"],
    }).end();
    return;
  }
  if (request.url === "/api/unavailable") {
    response.writeHead(429, { "Content-Type": "application/json", "Retry-After": "60", "Cache-Control": "no-store" }).end('{"error":"rate_limited"}');
    return;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
    url: request.url,
    cookie: request.headers.cookie,
    origin: request.headers.origin,
    host: request.headers.host,
    body: Buffer.concat(chunks).toString(),
  }));
});
await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
const originalBackend = process.env.BACKEND_URL;
process.env.BACKEND_URL = `http://127.0.0.1:${backend.address().port}`;
const root = fileURLToPath(new URL("..", import.meta.url));
const configFile = fileURLToPath(new URL("../vite.config.ts", import.meta.url));
const servers = [];

try {
  for (const mode of ["development", "preview"]) {
    const options = { root, configFile, server: { host: "127.0.0.1", port: 0 }, preview: { host: "127.0.0.1", port: 0 } };
    const server = mode === "development" ? await createServer(options) : await preview(options);
    servers.push(server);
    if (mode === "development") await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const route of ["/", "/sign-in", "/dashboard", "/courses/example?play=video", "/study-library?courseId=example", "/notes/example", "/unknown"]) {
      const response = await fetch(origin + route);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /text\/html/);
      assert.match(await response.text(), /id="root"/);
    }
    const echo = await fetch(origin + "/api/echo?test=1", {
      method: "POST",
      headers: { Cookie: "test_session=opaque", Origin: "http://localhost:3000", "Content-Type": "application/json" },
      body: '{"test":true}',
    });
    assert.deepEqual(await echo.json(), {
      url: "/api/echo?test=1", cookie: "test_session=opaque", origin: "http://localhost:3000",
      host: new URL(origin).host, body: '{"test":true}',
    });
    const callback = await fetch(origin + "/api/auth/callback/google?code=synthetic&state=test", { redirect: "manual" });
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), "/dashboard");
    assert.equal(callback.headers.getSetCookie().length, 2);
    assert.match(callback.headers.getSetCookie()[0], /HttpOnly/);
    const unavailable = await fetch(origin + "/api/unavailable");
    assert.equal(unavailable.status, 429);
    assert.equal(unavailable.headers.get("retry-after"), "60");
    assert.equal(unavailable.headers.get("cache-control"), "no-store");
    assert.deepEqual(await unavailable.json(), { error: "rate_limited" });
    for (const asset of ["/favicon.ico", "/FocusTube.png", "/brand-mark.svg"]) assert.equal((await fetch(origin + asset)).status, 200);
    const pageHtml = await (await fetch(origin)).text();
    assert.match(pageHtml, /rel="icon"[^>]+href="\/brand-mark\.svg"/);
    if (mode === "development") {
      const entry = await fetch(origin + "/src/main.tsx");
      assert.equal(entry.status, 200, "React entry module must transform successfully");
      assert.match(await entry.text(), /createRoot/);
    } else {
      const html = await (await fetch(origin)).text();
      const entryPath = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
      assert.ok(entryPath, "Production HTML must reference a bundled script");
      const entry = await fetch(origin + entryPath);
      assert.equal(entry.status, 200);
      assert.match(entry.headers.get("content-type"), /javascript/);
    }
    console.log(`${mode}: SPA deep links, API forwarding, cookies, Origin, callback redirects and errors passed`);
  }
  await new Promise((resolve, reject) => backend.close((error) => error ? reject(error) : resolve()));
  for (const server of servers) {
    const response = await fetch(`http://127.0.0.1:${server.httpServer.address().port}/api/auth/callback/google?code=DO_NOT_LOG_QUERY`, { redirect: "manual" });
    assert.equal(response.status, 502);
  }
  console.log("Disconnected backend returns 502; proxy logs must contain only the sanitized failure message.");
} finally {
  await Promise.all(servers.map((server) => server.close()));
  if (backend.listening) await new Promise((resolve) => backend.close(resolve));
  if (originalBackend === undefined) delete process.env.BACKEND_URL;
  else process.env.BACKEND_URL = originalBackend;
}
