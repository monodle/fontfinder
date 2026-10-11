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
 * 배포 날짜를 추출하거나 오늘 날짜로 생성
 * .env에 VITE_APP_RELEASE_DATE가 있으면 우선 사용, 없으면 오늘 날짜(로컬 기준) 반환
 */
function getReleaseDate() {
  const envPath = path.join(rootDir, ".env");
  let envDate = null;
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    const match = content.match(/^VITE_APP_RELEASE_DATE\s*=\s*(.+)$/m);
    if (match && match[1]) {
      envDate = match[1].trim().split("#")[0].trim().replace(/^["']|["']$/g, "").trim();
    }
  }

  const targetDate = envDate ? new Date(envDate) : new Date();
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, "0");
  const day = String(targetDate.getDate()).padStart(2, "0");

  return {
    dash: `${year}-${month}-${day}`, // YYYY-MM-DD
    dot: `${year}. ${month}. ${day}`,  // YYYY. MM. DD
  };
}

/**
 * README.md의 버전 및 배포일, 다운로드 링크 동기화
 */
function syncReadme(version, releaseDate) {
  const readmePath = path.join(rootDir, "README.md");
  if (!fs.existsSync(readmePath)) {
    return false;
  }

  try {
    let content = fs.readFileSync(readmePath, "utf8");
    const original = content;

    // 1. 배지 (Release & Updated)
    content = content.replace(
      /(badge\/Release-v)[0-9A-Za-z.-]+(-amber\.svg)/g,
      `$1${version}$2`
    );
    content = content.replace(
      /(badge\/Updated-)[0-9-]+(-success\.svg)/g,
      `$1${releaseDate.dash}$2`
    );

    // 2. 최신 버전 테이블 (| **`v1.1.0`** | **2026-10-11** | Latest Release)
    content = content.replace(
      /(\|\s*\*\*`v)[0-9A-Za-z.-]+(`\*\*\s*\|\s*\*\*)[0-9-]+(\*\*\s*\|\s*Latest Release)/g,
      `$1${version}$2${releaseDate.dash}$3`
    );

    // 3. 다운로드 버튼 설명문 (<b>v1.1.0 (2026-10-11 배포)</b>)
    content = content.replace(
      /(<b>v)[0-9A-Za-z.-]+(\s*\()[0-9-]+(\s*배포\s*\)<\/b>)/g,
      `$1${version}$2${releaseDate.dash}$3`
    );

    // 4. 설치 가이드 알림창 (> 💡 **현재 최신 안정 버전:** `v1.1.0` (배포 일자: `2026-10-11`))
    content = content.replace(
      /(현재 최신 안정 버전:\*\* `v)[0-9A-Za-z.-]+(` \(배포 일자: `)[0-9-]+(`\))/g,
      `$1${version}$2${releaseDate.dash}$3`
    );

    // 5. 플랫폼 다운로드 테이블 행 (| `1.1.0` | `2026-10-11` | `.dmg` / `.exe`)
    content = content.replace(
      /(\|\s*`)[0-9A-Za-z.-]+(`\s*\|\s*`)[0-9-]+(`\s*\|\s*`\.(dmg|exe|msi))/g,
      `$1${version}$2${releaseDate.dash}$3`
    );

    // 6. 다운로드 URL은 latest 릴리즈 경로 아래 Font.Finder_${version}_... 형태 유지
    content = content.replace(
      /(download\/latest\/Font\.Finder_)[0-9A-Za-z.-]+(_aarch64\.dmg)/g,
      `$1${version}$2`
    );
    content = content.replace(
      /(download\/latest\/Font\.Finder_)[0-9A-Za-z.-]+(_x64-setup\.exe)/g,
      `$1${version}$2`
    );

    if (content !== original) {
      fs.writeFileSync(readmePath, content, "utf8");
      return true;
    }
  } catch (err) {
    console.error("[sync-version] Failed to update README.md:", err);
  }
  return false;
}

/**
 * www/index.html의 버전 및 배포일, 다운로드 링크 동기화
 */
function syncWebIndex(version, releaseDate) {
  const htmlPath = path.join(rootDir, "www", "index.html");
  if (!fs.existsSync(htmlPath)) {
    return false;
  }

  try {
    let content = fs.readFileSync(htmlPath, "utf8");
    const original = content;

    // 1. JSON-LD 메타데이터
    content = content.replace(
      /("softwareVersion":\s*")[^"]+(")/g,
      `$1${version}$2`
    );
    content = content.replace(
      /("dateModified":\s*")[^"]+(")/g,
      `$1${releaseDate.dash}$2`
    );

    // 2. 상단 네비게이션 버전 배지
    content = content.replace(
      /(<span class="badge badge-subtle"[^>]*>v)[^<]+(<\/span>)/g,
      `$1${version}$2`
    );

    // 3. CTA 메인 버튼 서브텍스트
    content = content.replace(
      /(id="primaryDownloadSub">v)[0-9A-Za-z.-]+(\s+최신 정식 릴리즈)/g,
      `$1${version}$2`
    );

    // 4. 최신 버전 메타 인포 카드 (버전 및 일자)
    content = content.replace(
      /(id="releaseVersionVal">v)[0-9A-Za-z.-]+(<\/strong>)/g,
      `$1${version}$2`
    );
    content = content.replace(
      /(id="releaseDateVal"\s+datetime=")[^"]+(">[^<]+<\/time>)/g,
      `$1${releaseDate.dash}">${releaseDate.dot}</time>`
    );

    // 5. 인라인 OS 감지 스크립트 내 텍스트
    content = content.replace(
      /(sub\.textContent\s*=\s*'v)[0-9A-Za-z.-]+(\s+최신 정식 릴리즈)/g,
      `$1${version}$2`
    );

    // 6. 다운로드 링크: latest 릴리즈 경로 아래 Font.Finder_${version}_... 형태 유지
    content = content.replace(
      /(download\/latest\/Font\.Finder_)[0-9A-Za-z.-]+(_aarch64\.dmg)/g,
      `$1${version}$2`
    );
    content = content.replace(
      /(download\/latest\/Font\.Finder_)[0-9A-Za-z.-]+(_x64-setup\.exe)/g,
      `$1${version}$2`
    );

    // 7. 가이드 본문 코드 블록 내 파일명 동기화
    content = content.replace(
      /(<code>Font\.Finder_)[0-9A-Za-z.-]+(_aarch64\.dmg<\/code>)/g,
      `$1${version}$2`
    );
    content = content.replace(
      /(<code>Font\.Finder_)[0-9A-Za-z.-]+(_x64-setup\.exe<\/code>)/g,
      `$1${version}$2`
    );

    if (content !== original) {
      fs.writeFileSync(htmlPath, content, "utf8");
      return true;
    }
  } catch (err) {
    console.error("[sync-version] Failed to update www/index.html:", err);
  }
  return false;
}

/**
 * package.json, tauri.conf.json, Cargo.toml, README.md, www/index.html 버전을 .env 버전과 동기화
 */
export function syncAppVersion() {
  const version = getVersionFromEnv();
  if (!version) {
    return;
  }

  const releaseDate = getReleaseDate();
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

  // 4. README.md 동기화
  if (syncReadme(version, releaseDate)) {
    updatedFiles.push("README.md");
  }

  // 5. www/index.html 동기화
  if (syncWebIndex(version, releaseDate)) {
    updatedFiles.push("www/index.html");
  }

  if (updatedFiles.length > 0) {
    console.log(`[sync-version] Synchronized version ${version} (${releaseDate.dash}) in: ${updatedFiles.join(", ")}`);
  }
}

// 직접 CLI 실행 시
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncAppVersion();
}
