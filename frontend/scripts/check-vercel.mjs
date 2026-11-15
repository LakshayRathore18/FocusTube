import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

// Validate the tracked deployment config and existing build; no deployment.
const config = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8"));
    assert.equal(config.framework, "vite");
    assert.equal(config.installCommand, "npm ci");
    assert.equal(config.buildCommand, "npm run build");
    assert.equal(config.outputDirectory, "frontend/dist");
    assert.deepEqual(config.rewrites, [
      { source: "/api/:path*", destination: "https://focustube-api.onrender.com/api/:path*" },
      { source: "/(.*)", destination: "/index.html" },
    ]);
    assert.deepEqual(config.headers, [{ source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }]);
  const dist = new URL("../dist/", import.meta.url);
  const html = await readFile(new URL("index.html", dist), "utf8");
  assert.match(html, /rel="icon"[^>]+href="\/brand-mark\.svg"/);
  const entry = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
  assert.ok(entry);
  await access(new URL(entry.replace(/^\//, ""), dist));
  await access(new URL("brand-mark.svg", dist));
  console.log("Vercel config checks passed: build settings, API-first rewrites, no-store headers and built entry/favicon.");
  console.log("Hosted Vercel routing, cookies and OAuth still require deployment verification.");
