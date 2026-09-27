import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicFontsDir = path.join(rootDir, "public", "fonts");
const tmpDir = path.join(rootDir, "node_modules", ".cache", "font-setup-tmp");

const FONTS_TO_SETUP = [
  {
    pkg: "@fontsource-variable/noto-sans-kr",
    folder: "noto-sans-kr",
    standardFamily: "Noto Sans KR",
    originalFamily: "Noto Sans KR Variable",
  },
  {
    pkg: "@fontsource-variable/noto-sans-jp",
    folder: "noto-sans-jp",
    standardFamily: "Noto Sans JP",
    originalFamily: "Noto Sans JP Variable",
  },
  {
    pkg: "@fontsource-variable/noto-sans-sc",
    folder: "noto-sans-sc",
    standardFamily: "Noto Sans SC",
    originalFamily: "Noto Sans SC Variable",
  },
  {
    pkg: "@fontsource-variable/noto-sans-tc",
    folder: "noto-sans-tc",
    standardFamily: "Noto Sans TC",
    originalFamily: "Noto Sans TC Variable",
  },
  {
    pkg: "@fontsource-variable/noto-sans",
    folder: "noto-sans",
    standardFamily: "Noto Sans",
    originalFamily: "Noto Sans Variable",
  },
  {
    pkg: "@fontsource-variable/jetbrains-mono",
    folder: "jetbrains-mono",
    standardFamily: "JetBrains Mono",
    originalFamily: "JetBrains Mono Variable",
  },
];

async function main() {
  console.log("==> Setting up local fonts in public/fonts...");

  if (!fs.existsSync(publicFontsDir)) {
    fs.mkdirSync(publicFontsDir, { recursive: true });
  }

  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  const combinedCssBlocks = [];

  for (const item of FONTS_TO_SETUP) {
    console.log(`\nFetching ${item.pkg}...`);

    // 1. Get tarball URL
    const tarballUrl = execSync(`pnpm view ${item.pkg} dist.tarball`, {
      encoding: "utf-8",
    }).trim();

    const tgzFile = path.join(tmpDir, `${item.folder}.tgz`);
    const extractDir = path.join(tmpDir, item.folder);
    fs.mkdirSync(extractDir, { recursive: true });

    // 2. Download tarball
    execSync(`curl -sL "${tarballUrl}" -o "${tgzFile}"`, { stdio: "inherit" });

    // 3. Extract tarball (npm packages extract under 'package/')
    execSync(`tar -xzf "${tgzFile}" -C "${extractDir}"`, { stdio: "inherit" });

    const packageRoot = path.join(extractDir, "package");
    const targetFolder = path.join(publicFontsDir, item.folder);
    const targetFilesDir = path.join(targetFolder, "files");

    if (!fs.existsSync(targetFilesDir)) {
      fs.mkdirSync(targetFilesDir, { recursive: true });
    }

    // 4. Copy woff2 files
    const srcFilesDir = path.join(packageRoot, "files");
    if (fs.existsSync(srcFilesDir)) {
      const files = fs.readdirSync(srcFilesDir);
      for (const file of files) {
        if (file.endsWith(".woff2")) {
          fs.copyFileSync(
            path.join(srcFilesDir, file),
            path.join(targetFilesDir, file)
          );
        }
      }
    }

    // 5. Copy license
    const licenseSrc = path.join(packageRoot, "LICENSE");
    if (fs.existsSync(licenseSrc)) {
      fs.copyFileSync(licenseSrc, path.join(targetFolder, "LICENSE"));
    }

    // 6. Process CSS
    const cssPath = path.join(packageRoot, "index.css");
    if (fs.existsSync(cssPath)) {
      let cssContent = fs.readFileSync(cssPath, "utf-8");

      // Replace font-family name with both standard and variable name for maximum compatibility
      // e.g. 'Noto Sans KR Variable' -> 'Noto Sans KR'
      const familyRegex = new RegExp(
        `font-family:\\s*['"]?${item.originalFamily}['"]?`,
        "g"
      );
      cssContent = cssContent.replace(
        familyRegex,
        `font-family: '${item.standardFamily}'`
      );

      // Also create an alias rule or keep both if needed:
      // Rewrite url(./files/...) -> url(/fonts/<folder>/files/...)
      cssContent = cssContent.replace(
        /url\(\.?\/?files\//g,
        `url(/fonts/${item.folder}/files/`
      );

      // Save individual css
      fs.writeFileSync(path.join(targetFolder, "index.css"), cssContent, "utf-8");

      combinedCssBlocks.push(`/* ${item.standardFamily} */\n` + cssContent);
    }

    console.log(`✓ ${item.standardFamily} installed in /fonts/${item.folder}`);
  }

  // 7. Write combined fonts.css
  const combinedCssPath = path.join(publicFontsDir, "fonts.css");
  fs.writeFileSync(combinedCssPath, combinedCssBlocks.join("\n\n"), "utf-8");
  console.log(`\n✓ Combined stylesheet created at public/fonts/fonts.css`);

  // Clean up tmp
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log("\n==> Font setup finished successfully!");
}

main().catch((err) => {
  console.error("Font setup failed:", err);
  process.exit(1);
});
