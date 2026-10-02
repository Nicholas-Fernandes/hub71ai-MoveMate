import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientRoot = join(projectRoot, "artifacts/movemate-abu-dhabi/dist/public");
const distRoot = join(projectRoot, "dist");
const workerDirectory = join(distRoot, "server");
const workerSource = join(projectRoot, "scripts/movemate-site-worker.ts");
const workerTemp = join(workerDirectory, "worker-bundle.js");
const workerOutput = join(workerDirectory, "index.js");
const esbuild = join(projectRoot, "artifacts/api-server/node_modules/.bin/esbuild");

if (!existsSync(join(clientRoot, "index.html"))) throw new Error("Build the MoveMate web app before packaging its Site Worker.");
if (!existsSync(esbuild)) throw new Error("Install the API server workspace dependencies before bundling the Site Worker.");

const assets = {};
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute);
    else {
      const name = relative(clientRoot, absolute).split(sep).join("/");
      const extension = extname(name).toLowerCase();
      const contentType = extension === ".html" ? "text/html; charset=utf-8"
        : extension === ".css" ? "text/css; charset=utf-8"
        : extension === ".js" ? "text/javascript; charset=utf-8"
        : extension === ".svg" ? "image/svg+xml"
        : extension === ".png" ? "image/png"
        : extension === ".webp" ? "image/webp"
        : extension === ".woff2" ? "font/woff2"
        : "application/octet-stream";
      assets[name] = { contentType, body: readFileSync(absolute).toString("base64") };
    }
  }
}

collect(clientRoot);
rmSync(distRoot, { recursive: true, force: true });
mkdirSync(workerDirectory, { recursive: true });
mkdirSync(join(distRoot, ".openai"), { recursive: true });

const result = spawnSync(esbuild, [workerSource, "--bundle", "--platform=browser", "--format=esm", "--target=es2022", `--outfile=${workerTemp}`], {
  cwd: projectRoot,
  encoding: "utf8",
});
if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Could not bundle the MoveMate Site Worker.");

const bundle = readFileSync(workerTemp, "utf8");
const placeholder = '"__MOVEMATE_ASSET_MAP__"';
if (!bundle.includes(placeholder)) throw new Error("The compiled Worker no longer contains its asset map placeholder.");
writeFileSync(workerOutput, bundle.replace(placeholder, JSON.stringify(JSON.stringify(assets))));
rmSync(workerTemp, { force: true });
cpSync(join(projectRoot, ".openai/hosting.json"), join(distRoot, ".openai/hosting.json"));
console.log(`Built MoveMate Site Worker with ${Object.keys(assets).length} static assets (${(readFileSync(workerOutput).byteLength / 1024 / 1024).toFixed(2)} MiB).`);
