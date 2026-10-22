import { build } from "esbuild"

await build({
  entryPoints: ["electron/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist-electron/main.js",
  external: ["electron"],
})

await build({
  entryPoints: ["electron/preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist-electron/preload.cjs",
  external: ["electron"],
})

await build({
  entryPoints: ["server/catalog.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist-electron/catalog.js",
})
