import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "../dist");
const PORT = 8765;
const ROUTES = ["/landing", "/faq", "/whitepaper", "/guides"];

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".xml": "application/xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function serve(req, res) {
  let filePath = path.join(DIST_DIR, req.url.split("?")[0] === "/" ? "index.html" : req.url.split("?")[0]);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, "index.html");
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

async function main() {
  const server = http.createServer(serve);
  await new Promise((r) => server.listen(PORT, r));
  console.log(`[prerender] server on http://localhost:${PORT}`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--lang=zh-TW"],
  });

  for (const route of ROUTES) {
    const url = `http://localhost:${PORT}${route}`;
    console.log(`[prerender] ${url}`);

    const page = await browser.newPage({ locale: "zh-TW" });
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    try {
      await page.waitForFunction(() => !document.body.innerText.includes("正在恢復登入狀態"), { timeout: 8000 });
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));

    const html = await page.content();

    const dir = path.join(DIST_DIR, route.slice(1));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    console.log(`  -> dist${route}/index.html (${(html.length / 1024).toFixed(0)} KB)`);

    await page.close();
  }

  await browser.close();
  server.close();
  console.log("[prerender] done");
}

main().catch((err) => {
  console.error("[prerender] failed:", err);
  process.exit(1);
});
