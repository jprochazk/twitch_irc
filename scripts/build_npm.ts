import { build, emptyDir } from "https://deno.land/x/dnt@0.33.1/mod.ts";

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
    webSocket: true,
    crypto: true,
  },
  esModule: true,
  scriptModule: "cjs",
  skipSourceOutput: true,
  package: {
    // package.json properties
    name: "@jprochazk/twitch_irc",
    version: Deno.args[0],
    description: "Twitch chat client",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/jprochazk/twitch_irc.git",
    },
    bugs: {
      url: "https://github.com/jprochazk/twitch_irc/issues",
    },
  },
});

// post build steps
Deno.copyFileSync("LICENSE", "npm/LICENSE");
Deno.copyFileSync("README.md", "npm/README.md");
