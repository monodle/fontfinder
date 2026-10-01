<div align="center">

<img src="./src-tauri/icons/128x128.png" alt="FontFinder Logo" />

# FontFinder (폰트파인더)

**차세대 오픈소스 데스크톱 폰트 매니저**
시스템에 폰트를 직접 설치하지 않고도 수천 개의 폰트 파일을 즉시 미리보고, 분류하고, 필요할 때만 활성화하세요.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-lightgrey.svg)](#다운로드-및-설치)
[![Release](https://img.shields.io/badge/Release-v0.2.1-amber.svg)](https://github.com/monodle/fontfinder/releases/tag/latest)

<br />

### 📥 최신 버전 다운로드

깃허브 릴리즈에서 운영체제에 맞는 설치 파일을 다운로드하세요.

[![Download for macOS](https://img.shields.io/badge/macOS%20(Apple%20Silicon)-Download%20.dmg-black?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/monodle/fontfinder/releases/download/latest/Font.Finder_latest_aarch64.dmg)
&nbsp;&nbsp;
[![Download for Windows](https://img.shields.io/badge/Windows%20(x64)-Download%20.msi%20%2F%20.exe-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/monodle/fontfinder/releases/download/latest/Font.Finder_latest_x64-setup.exe)

<p align="center">
  <sub>* 위 버튼 클릭 시 최신 릴리즈 다운로드 링크로 연결됩니다.</sub>
</p>

</div>

---

## ✨ 왜 FontFinder인가요?

디자이너와 크리에이터에게 수많은 폰트 파일 관리는 늘 번거로운 작업입니다.
시스템에 수천 개의 폰트를 모두 설치하면 PC가 느려지고 프로그램의 폰트 메뉴가 복잡해집니다.

**FontFinder**는 시스템 부하 없이 폴더 안의 폰트 파일을 즉시 스캔하여 렌더링하고, 작업할 때만 폰트를 켜고 끌 수 있는 빠르고 아름다운 폰트 워크스페이스입니다.

---

## 🚀 다운로드 및 설치

### 1. 다운로드 링크

| 플랫폼      | 아키텍처      | 형식            | 다운로드                                                                                                                            |
| :---------- | :------------ | :-------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| **macOS**   | Apple Silicon | `.dmg`          | [**macOS (Apple Silicon) 다운로드**](https://github.com/monodle/fontfinder/releases/download/latest/Font.Finder_latest_aarch64.dmg) |
| **Windows** | x64 (64-bit)  | `.exe` / `.msi` | [**Windows (x64) 다운로드**](https://github.com/monodle/fontfinder/releases/download/latest/Font.Finder_latest_x64-setup.exe)       |

> 💡 추후 업데이트되는 새 버전은 [Releases 페이지](https://github.com/monodle/fontfinder/releases)에서도 확인하실 수 있습니다.

---

### 2. 운영체제별 설치 안내

#### 🍏 macOS 설치 및 실행 시 참고사항
1. 다운로드한 `.dmg` 파일을 더블 클릭하여 실행합니다.
2. `FontFinder.app` 아이콘을 `Applications` 폴더로 드래그 앤 드롭합니다.
3. **"확인되지 않은 개발자가 배포했기 때문에 열 수 없습니다"** 또는 **손상 경고**가 표시되는 경우 아래 방법 중 하나를 진행해 주세요.

   **방법 1. 터미널 명령어로 해결 (권장)**
   - `Terminal(터미널)` 앱을 실행합니다. (`Command + Space` > `Terminal` 입력 후 엔터)
   - 아래 명령어를 복사하여 붙여넣고 엔터를 누릅니다:
     ```bash
     xattr -cr /Applications/FontFinder.app
     ```
   - 이후 `FontFinder.app`을 실행하면 정상 동작합니다.

   **방법 2. 시스템 설정에서 허용**
   - 경고창이 나타나면 **[확인]**을 누릅니다.
   - Mac 좌측 상단 **Apple 메뉴() > [시스템 설정...]**으로 이동합니다.
   - **[개인정보 보호 및 보안]** 탭으로 이동하여 하단 **보안** 섹션을 확인합니다.
   - *"FontFinder.app은 확인되지 않은 개발자가 배포했기 때문에 사용이 차단되었습니다."* 안내 옆의 **[확인 없이 열기]**(또는 **[그래도 열기]**)를 클릭합니다.

#### 🪟 Windows 설치 및 실행 시 참고사항
1. 다운로드한 설치 파일(`.exe` 또는 `.msi`)을 실행합니다.
2. **Microsoft Defender SmartScreen(PC 보호)** 경고 창이 나타나는 경우:
   - 창 내의 **[추가 정보]**를 클릭합니다.
   - 하단에 나타나는 **[실행]** 버튼을 클릭하여 설치를 계속 진행합니다.

---

## 🌟 주요 기능

- ⚡ **미설치 폰트 즉시 미리보기**: 시스템에 설치하지 않고도 폴더 내 `.ttf`, `.otf`, `.woff`, `.ttc` 파일을 웹뷰에서 실시간 렌더링
- 🏎️ **초고속 병렬 스캔 & 대용량 가상화 스크롤**: Rust `rayon` 기반 병렬 스캐너와 가상 스크롤로 수천~수만 개의 폰트도 버벅임 없이 탐색
- 🎨 **리디북스/애플북스 스타일의 Warm Paper 테마**: 장시간 텍스트 작업에도 눈이 편안한 세피아 크림 톤의 프리미엄 UI
- 🎛️ **가변 폰트(Variable Font) 세부 조절**: `wght` 등 축 슬라이더를 통해 두께를 실시간으로 조절하며 감상
- 🔍 **정밀 폰트 비교 (Font Diff)**: 최대 5개 폰트를 한 캔버스에 레이어로 겹쳐(Overlay) 투명도·오프셋·외곽선 모드로 글리프 형태와 자폭의 미세한 차이를 정밀하게 비교 분석
- 📁 **컬렉션 & 세트 관리**: 프로젝트별, 스타일별(고딕, 명조, 손글씨 등) 세트를 생성하고 즐겨찾기 관리
- 🔌 **원클릭 폰트 임시 활성화 & 설치**: 디자인 프로그램 작업 중에만 폰트를 켜두거나 시스템 영구 설치 가능
- 🌐 **8개 언어 다국어 인터페이스**: 한국어, 영어, 스페인어, 일본어, 중국어(간체/번체), 독일어, 프랑스어 지원

---

## 📂 지원 폰트 포맷

| 포맷 확장자 | 설명                                           | 지원 여부 |
| :---------- | :--------------------------------------------- | :-------: |
| `.ttf`      | TrueType Font                                  |  ✅ 지원   |
| `.otf`      | OpenType Font                                  |  ✅ 지원   |
| `.woff`     | Web Open Font Format                           |  ✅ 지원   |
| `.ttc`      | TrueType Collection (단일 파일 내 복수 패밀리) |  ✅ 지원   |

---

## 🛠️ 기술 스택

- **Frontend**: `React 19`, `TypeScript`, `Vite 6`, `Tailwind CSS v4`, `@tanstack/react-virtual`, `lucide-react`
- **Backend**: `Tauri v2`, `Rust 2021 Edition`, `ttf-parser`, `rayon`, `rusqlite`
- **Native OS Font API**: `macOS CoreText FFI` / `Windows Win32 GDI`

---

## 📬 문의 및 피드백

버그 리포트, 기능 제안 또는 기술적 문의는 아래 메일이나 GitHub Issues를 통해 남겨주세요.

- **이메일:** [문의 메일 보내기](mailto:fontfontfinder@gmail.com?subject=%5BFontFinder%5D%20%EB%AC%B8%EC%9D%98%20%EB%B0%8F%20%ED%94%BC%EB%93%9C%EB%B0%B1&body=%5B%EA%B8%B0%EB%B3%B8%20%EC%A0%95%EB%B3%94%5D%0A-%20OS%20%ED%99%98%EA%B2%BD%3A%20macOS%20%2F%20Windows%0A-%20%EC%95%B1%20%EB%B2%84%EC%A0%84%3A%20v0.1.5%0A%0A%5B%EB%AC%B8%EC%9D%98%20%EB%82%B4%EC%9A%A9%5D%0A) (`fontfontfinder@gmail.com`)
- **이슈 등록:** [GitHub Issues](https://github.com/monodle/fontfinder/issues)

---

## 📄 라이선스

이 프로젝트는 [GNU General Public License v3.0 (GPL-3.0)](./LICENSE) 라이선스를 따릅니다.

---
