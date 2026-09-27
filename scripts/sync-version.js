import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

/**
 * SemVer 형식으로 버전 문자열 정규화
 * 예: "v0.1.3" -> "0.1.3", "v2.0" -> "2.0.0"
 */
function normalizeSemVer(rawVersion) {
  if (!rawVersion || typeof rawVersion !== "string") {
    return null;
  }

  let cleaned = rawVersion.trim().replace(/^["']|["']$/g, "").trim();
  if (cleaned.startsWith("v") || cleaned.startsWith("V")) {
    cleaned = cleaned.slice(1).trim();
  }

  // Major.Minor 형태(예: "2.0")일 경우 Patch 추가
  if (/^\d+\.\d+$/.test(cleaned)) {
    cleaned = `${cleaned}.0`;
  }

  // 기본 유효한 SemVer 패턴 (Major.Minor.Patch[-prerelease][+build])
  const semverRegex = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
  if (!semverRegex.test(cleaned)) {
    console.warn(`[sync-version] Warning: '${rawVersion}' is not a standard SemVer string.`);
  }

  return cleaned;
}

/**
 * .env 파일에서 VITE_APP_VERSION 값을 추출
 */
function getVersionFromEnv() {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) {
    return null;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const match = content.match(/^VITE_APP_VERSION\s*=\s*(.+)$/m);
  if (!match || !match[1]) {
    return null;
  }

  let val = match[1].trim();
  // 주석 제거
  if (val.includes("#")) {
    val = val.split("#")[0].trim();
  }

  return normalizeSemVer(val);
}

/**
 * package.json, tauri.conf.json, Cargo.toml의 버전을 .env 버전과 동기화
 */
export function syncAppVersion() {
  const version = getVersionFromEnv();
  if (!version) {
    return;
  }

  const updatedFiles = [];

  // 1. package.json 동기화
  const pkgPath = path.join(rootDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.version !== version) {
        pkg.version = version;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
        updatedFiles.push("package.json");
      }
    } catch (err) {
      console.error("[sync-version] Failed to update package.json:", err);
    }
  }

  // 2. src-tauri/tauri.conf.json 동기화
  const tauriConfPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
  if (fs.existsSync(tauriConfPath)) {
    try {
      const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
      if (tauriConf.version !== version) {
        tauriConf.version = version;
        fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n", "utf8");
        updatedFiles.push("src-tauri/tauri.conf.json");
      }
    } catch (err) {
      console.error("[sync-version] Failed to update tauri.conf.json:", err);
    }
  }

  // 3. src-tauri/Cargo.toml 동기화 ([package] 섹션의 version만 치환)
  const cargoTomlPath = path.join(rootDir, "src-tauri", "Cargo.toml");
  if (fs.existsSync(cargoTomlPath)) {
    try {
      const content = fs.readFileSync(cargoTomlPath, "utf8");
      const packageRegex = /(\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m;
      if (packageRegex.test(content)) {
        const updated = content.replace(packageRegex, `$1${version}$2`);
        if (updated !== content) {
          fs.writeFileSync(cargoTomlPath, updated, "utf8");
          updatedFiles.push("src-tauri/Cargo.toml");
        }
      }
    } catch (err) {
      console.error("[sync-version] Failed to update Cargo.toml:", err);
    }
  }

  if (updatedFiles.length > 0) {
    console.log(`[sync-version] Synchronized version to ${version} in: ${updatedFiles.join(", ")}`);
  }
}

// 직접 CLI 실행 시
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncAppVersion();
}
