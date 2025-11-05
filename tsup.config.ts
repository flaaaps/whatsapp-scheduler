import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["server.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  splitting: false,
  bundle: true, // Bundle the application code
  external: [
    // External all node_modules except our local code
    /^[^.]/,  // Anything that doesn't start with . (all node_modules)
  ],
  noExternal: [
    // Re-include our local code to be bundled
    /^\./, // Anything starting with .
  ],
  dts: false, // No need for .d.ts files for executable
  outExtension() {
    return {
      js: ".js",
    };
  },
});
