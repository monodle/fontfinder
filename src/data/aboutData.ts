export interface CreatorInfo {
  id: string;
  name: string;
  role: string;
  githubUrl: string;
  githubHandle: string;
  avatarUrl: string;
  bio: string;
}

export interface OpenSourceLicense {
  name: string;
  license: string;
  description: string;
  url: string;
  category: "frontend" | "backend";
}

export interface PrivacyPolicySection {
  title: string;
  description: string;
  points: string[];
}

// 개발팀 인원이 한국인이므로 고유명사/원문(한국어)을 유지하며, 향후에도 다국어(i18n) 번역을 적용하지 않습니다.
export const CREATORS: CreatorInfo[] = [
  {
    id: "monodoro",
    name: "이정민",
    role: "Developer, Architect, QA",
    githubUrl: "https://github.com/monodle",
    githubHandle: "@monodle",
    avatarUrl: "https://github.com/monodle.png",
    bio: "Happy Thinker",
  },
  {
    id: "ken-choi",
    name: "최진원",
    role: "Product Designer, Product Manager, QA",
    githubUrl: "https://github.com/sojoongpapa",
    githubHandle: "@sojoongpapa",
    avatarUrl: "https://github.com/sojoongpapa.png",
    bio: "Ken, the dreamer",
  },
];

export const OPEN_SOURCE_LICENSES: OpenSourceLicense[] = [
  // Frontend
  {
    name: "React & React DOM",
    license: "MIT License",
    description: "UI 렌더링 및 컴포넌트 라이프사이클 관리 라이브러리",
    url: "https://github.com/facebook/react",
    category: "frontend",
  },
  {
    name: "Tauri",
    license: "MIT / Apache-2.0",
    description: "경량의 고성능 멀티플랫폼 데스크톱 애플리케이션 프레임워크",
    url: "https://github.com/tauri-apps/tauri",
    category: "frontend",
  },
  {
    name: "Lucide React",
    license: "ISC License",
    description: "모던하고 미려한 오픈소스 SVG 아이콘 팩",
    url: "https://github.com/lucide-icons/lucide",
    category: "frontend",
  },
  {
    name: "@tanstack/react-virtual",
    license: "MIT License",
    description: "수천 개의 폰트 목록을 빠르고 부드럽게 렌더링하는 가상화 스크롤 엔진",
    url: "https://github.com/TanStack/virtual",
    category: "frontend",
  },
  {
    name: "i18next & react-i18next",
    license: "MIT License",
    description: "국제화 및 다국어 지원 프레임워크",
    url: "https://github.com/i18next/react-i18next",
    category: "frontend",
  },
  {
    name: "Tailwind CSS",
    license: "MIT License",
    description: "유틸리티 우선 CSS 프레임워크",
    url: "https://github.com/tailwindlabs/tailwindcss",
    category: "frontend",
  },
  {
    name: "Vite",
    license: "MIT License",
    description: "초고속 차세대 프론트엔드 빌드 툴",
    url: "https://github.com/vitejs/vite",
    category: "frontend",
  },
  {
    name: "TypeScript",
    license: "Apache-2.0 License",
    description: "정적 타입 지원 및 견고한 코드 안정성을 제공하는 언어",
    url: "https://github.com/microsoft/TypeScript",
    category: "frontend",
  },
  {
    name: "tailwind-merge",
    license: "MIT License",
    description: "조건부 Tailwind CSS 클래스 충돌 방지 및 최적화 병합 유틸리티",
    url: "https://github.com/dcastil/tailwind-merge",
    category: "frontend",
  },
  {
    name: "Zod",
    license: "MIT License",
    description: "타입 안정성 보장 및 런타임 데이터 스키마 유효성 검증 라이브러리",
    url: "https://github.com/colinhacks/zod",
    category: "frontend",
  },
  {
    name: "fractional-indexing",
    license: "MIT License",
    description: "폰트 세트 정렬 및 드래그 앤 드롭 순서 변경을 위한 분수 인덱싱 알고리즘",
    url: "https://github.com/rocicorp/fractional-indexing",
    category: "frontend",
  },

  // Backend (Rust)
  {
    name: "Rusqlite",
    license: "MIT License",
    description: "안전하고 신속한 로컬 SQLite3 데이터베이스 인터페이스",
    url: "https://github.com/rusqlite/rusqlite",
    category: "backend",
  },
  {
    name: "ttf-parser",
    license: "MIT / Apache-2.0",
    description: "고성능 TrueType/OpenType 폰트 바이너리 파서",
    url: "https://github.com/RazrFalcon/ttf-parser",
    category: "backend",
  },
  {
    name: "Tokio",
    license: "MIT License",
    description: "Rust 비동기 런타임 및 이벤트 루프 엔진",
    url: "https://github.com/tokio-rs/tokio",
    category: "backend",
  },
  {
    name: "Rayon",
    license: "MIT / Apache-2.0",
    description: "수만 개 폰트 메타데이터를 병렬로 스캔하는 데이터 병렬 처리 라이브러리",
    url: "https://github.com/rayon-rs/rayon",
    category: "backend",
  },
  {
    name: "reqwest",
    license: "Apache-2.0 / MIT",
    description: "Google Fonts 및 Fontsource API 연동과 폰트 다운로드를 위한 비동기 HTTP 클라이언트",
    url: "https://github.com/seanmonstar/reqwest",
    category: "backend",
  },
  {
    name: "notify-debouncer-mini",
    license: "MIT / Apache-2.0",
    description: "운영체제 파일 시스템 변경 이벤트 감지 및 디바운스",
    url: "https://github.com/notify-rs/notify",
    category: "backend",
  },
  {
    name: "window-vibrancy",
    license: "MIT / Apache-2.0",
    description: "macOS/Windows의 투명 아크릴 및 비브란시 네이티브 창 효과",
    url: "https://github.com/tauri-apps/window-vibrancy",
    category: "backend",
  },
  {
    name: "Tauri Official Plugins",
    license: "MIT / Apache-2.0",
    description: "네이티브 다이얼로그(dialog), 창 상태 기억(window-state), 중복 실행 방지(single-instance)",
    url: "https://github.com/tauri-apps/plugins-workspace",
    category: "backend",
  },
  {
    name: "xxhash-rust",
    license: "BSL-1.0",
    description: "초고속 XXH3 알고리즘 기반 계층형 폰트 핑거프린트 식별 라이브러리",
    url: "https://github.com/DoumanAsh/xxhash-rust",
    category: "backend",
  },
  {
    name: "walkdir",
    license: "Unlicense / MIT",
    description: "효율적인 파일 시스템 디렉토리 재귀 탐색 라이브러리",
    url: "https://github.com/BurntSushi/walkdir",
    category: "backend",
  },
  {
    name: "serde & serde_json",
    license: "MIT / Apache-2.0",
    description: "고성능 Rust 데이터 구조 직렬화 및 역직렬화 프레임워크",
    url: "https://github.com/serde-rs/serde",
    category: "backend",
  },
  {
    name: "trash",
    license: "MIT License",
    description: "폰트 파일을 영구 삭제 대신 OS 휴지통으로 안전하게 이동시키는 네이티브 라이브러리",
    url: "https://github.com/Byron/trash-rs",
    category: "backend",
  },
  {
    name: "unicode-normalization",
    license: "MIT / Apache-2.0",
    description: "macOS NFD 한글 자모 분리 방지 및 파일 경로 NFC 유니코드 정규화",
    url: "https://github.com/unicode-rs/unicode-normalization",
    category: "backend",
  },
  {
    name: "encoding_rs",
    license: "Apache-2.0 / MIT",
    description: "레거시 및 다국어 인코딩(EUC-KR, Shift_JIS 등) 폰트 이름 테이블 디코딩",
    url: "https://github.com/hsivonen/encoding_rs",
    category: "backend",
  },
  {
    name: "sha2",
    license: "MIT / Apache-2.0",
    description: "폰트 파일 무결성 검증 및 고유 식별 해시(SHA-256) 생성 라이브러리",
    url: "https://github.com/RustCrypto/hashes",
    category: "backend",
  },
  {
    name: "percent-encoding",
    license: "MIT / Apache-2.0",
    description: "커스텀 폰트 스트리밍 프로토콜(font://) URL 인코딩 및 디코딩",
    url: "https://github.com/servo/rust-url",
    category: "backend",
  },
  {
    name: "thiserror",
    license: "MIT / Apache-2.0",
    description: "Rust 맞춤형 에러 열거형 및 오류 컨텍스트 관리 라이브러리",
    url: "https://github.com/dtolnay/thiserror",
    category: "backend",
  },
];

export const PRIVACY_POLICY_SUMMARY = {
  isLocalOnly: true,
  hasAnalytics: false,
  networkPolicy: "100% 로컬 프라이빗 (No Tracking, No Telemetry)",
  lastUpdated: "2026-09-26",
};

export const PRIVACY_POLICY_SECTIONS: PrivacyPolicySection[] = [
  {
    title: "1. 100% 로컬 데이터 저장 및 무(無)수집 원칙",
    description:
      "Font Finder는 사용자의 개인정보나 활동 로그를 수집하지 않습니다. 앱에서 등록한 폰트 경로, 즐겨찾기, 서재 세트 및 사용자 환경 설정은 사용자의 로컬 컴퓨터 SQLite 데이터베이스에만 저장되며, 어떠한 외부 원격 서버로도 전송되지 않습니다.",
    points: [
      "회원가입, 로그인, 개인 식별 정보(PII) 요구 없음",
      "사용자가 등록한 폰트 파일 및 폴더 정보는 오직 사용자 기기 내에만 존재",
      "데이터베이스(fontfinder.db)는 OS 표준 로컬 앱 데이터 경로에 보관",
    ],
  },
  {
    title: "2. 어떠한 외부 통신이나 추적(트래커)도 하지 않습니다",
    description:
      "본 애플리케이션에는 Google Analytics, Mixpanel, Sentry 등의 트래킹 코드나 원격 진단(Telemetry) 도구가 일체 포함되어 있지 않습니다.",
    points: [
      "사용자 행동 분석 추적기(Tracker) 일체 미탑재",
      "외부 API 호출이나 광고 SDK 미포함",
      "로컬 폰트 최적화 스크립트 실행 외에 불필요한 백그라운드 네트워크 연결 없음",
    ],
  },
  {
    title: "3. 파일 접근 권한 및 안전성",
    description:
      "Font Finder가 요청하는 파일 접근 권한은 사용자가 직접 추가한 폰트 폴더를 검색하고 글꼴 메타데이터를 파싱하기 위한 목적으로만 사용됩니다.",
    points: [
      "사용자가 명시적으로 선택한 폴더에 한해서만 읽기 및 파일 감시(Watcher) 수행",
      "임시 폰트 활성화 시에도 OS의 공식 폰트 등록 API만 호출",
      "언제든지 설정 > 시스템 관리에서 모든 캐시와 앱 데이터를 완전히 삭제 가능",
    ],
  },
];
