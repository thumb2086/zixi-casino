import { createServer } from "vite";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

globalThis.window = globalThis;
globalThis.document = { documentElement: { lang: "" }, createElement: () => ({}) };
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.navigator = { language: "zh-TW", userLanguage: "zh-TW" };
globalThis.location = { href: "", pathname: "/", search: "" };
globalThis.AudioContext = class {};
globalThis.HTMLHtmlElement = class {};
globalThis.HTMLDivElement = class {};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "../dist");
const ROUTES = ["/landing", "/faq", "/whitepaper", "/guides"];

async function main() {
  const vite = await createServer({
    root: path.resolve(__dirname, ".."),
    server: { middlewareMode: true },
    appType: "custom",
  });

  const { default: AppContent } = await vite.ssrLoadModule("/src/App.tsx");

  const template = fs.readFileSync(path.join(DIST_DIR, "index.html"), "utf-8");

  for (const route of ROUTES) {
    const queryClient = new QueryClient();
    const helmetContext = {};

    const appHtml = renderToString(
      HelmetProvider({ context: helmetContext },
        QueryClientProvider({ client: queryClient },
          StaticRouter({ location: route },
            AppContent()
          )
        )
      )
    );

    const { helmet } = helmetContext;

    let html = template;
    html = html.replace(
      'lang="zh-Hant"',
      `lang="${helmet?.htmlAttributes?.toString()?.match(/lang="([^"]+)"/)?.[1] || "zh-Hant"}"`
    );
    html = html.replace("<title>", `${helmet?.title?.toString() || ""}<title>`);

    const dir = path.join(DIST_DIR, route.slice(1));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    console.log(`  -> dist${route}/index.html (${(html.length / 1024).toFixed(0)} KB)`);
  }

  await vite.close();
  console.log("[prerender] done");
}

main().catch((err) => {
  console.error("[prerender] failed:", err);
  process.exit(1);
});
