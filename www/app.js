/**
 * FontFinder Promotion Landing Page Scripts
 * Includes OS detection, dynamic CTA & guide tab synchronization,
 * mobile responsive navigation, and clipboard copy.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initGuideTabs();
  initOsDetection();
  initCopyButton();
});

/**
 * Mobile navigation menu drawer toggle
 */
function initMobileMenu() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');

  if (!menuBtn || !navLinks) {
    return;
  }

  menuBtn.addEventListener('click', () => {
    const isExpanded = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!isExpanded));
    menuBtn.classList.toggle('active');
    navLinks.classList.toggle('active');
  });

  // Close mobile menu when a nav link is clicked
  const links = navLinks.querySelectorAll('.nav-link');
  links.forEach((link) => {
    link.addEventListener('click', () => {
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.classList.remove('active');
      navLinks.classList.remove('active');
    });
  });
}

/**
 * Detect client OS and update primary download CTA button & alternative links & guide tab
 */
function initOsDetection() {
  const primaryBtn = document.getElementById('primaryDownloadBtn');
  const primaryIcon = document.getElementById('primaryDownloadIcon');
  const primaryText = document.getElementById('primaryDownloadText');
  const primarySub = document.getElementById('primaryDownloadSub');
  const altWinLink = document.getElementById('altWinLink');
  const altMacLink = document.getElementById('altMacLink');

  if (!primaryBtn || !primaryIcon || !primaryText || !primarySub) {
    return;
  }

  const userAgent = (navigator.userAgent || navigator.platform || '').toLowerCase();
  const isWindows = userAgent.includes('win');
  const isApple = userAgent.includes('mac') || userAgent.includes('darwin') || userAgent.includes('iphone') || userAgent.includes('ipad');

  const macDownloadUrl = 'https://github.com/monodle/fontfinder/releases/download/latest/Font.Finder_latest_aarch64.dmg';
  const winDownloadUrl = 'https://github.com/monodle/fontfinder/releases/download/latest/Font.Finder_latest_x64-setup.exe';

  if (isWindows) {
    // Windows 사용자: Windows 우선 노출
    primaryBtn.href = winDownloadUrl;
    primaryBtn.classList.add('btn-windows');
    primaryIcon.textContent = '🪟';
    primaryText.textContent = 'Windows (x64) 다운로드';
    primarySub.textContent = 'v1.0.0 정식 릴리즈 (.exe / .msi)';

    if (altWinLink) altWinLink.style.display = 'none';
    if (altMacLink) altMacLink.style.display = 'inline';

    setGuideTab('windows');
  } else if (isApple) {
    // Apple(macOS, iOS) 사용자: macOS 우선 노출
    primaryBtn.href = macDownloadUrl;
    primaryBtn.classList.remove('btn-windows');
    primaryIcon.textContent = '🍎';
    primaryText.textContent = 'macOS (Apple Silicon) 다운로드';
    primarySub.textContent = 'v1.0.0 정식 릴리즈 (.dmg)';

    if (altWinLink) altWinLink.style.display = 'inline';
    if (altMacLink) altMacLink.style.display = 'none';

    setGuideTab('macos');
  } else {
    // 기타 (기본 macOS 권장 형태 유지)
    primaryBtn.href = macDownloadUrl;
    primaryBtn.classList.remove('btn-windows');
    primaryIcon.textContent = '🍎';
    primaryText.textContent = 'macOS (Apple Silicon) 다운로드';
    primarySub.textContent = 'v1.0.0 정식 릴리즈 (.dmg)';

    if (altWinLink) altWinLink.style.display = 'inline';
    if (altMacLink) altMacLink.style.display = 'none';

    setGuideTab('macos');
  }
}

/**
 * Setup tabs for macOS / Windows installation guide with OS switching
 */
function initGuideTabs() {
  const tabMac = document.getElementById('tabMac');
  const tabWin = document.getElementById('tabWin');

  if (!tabMac || !tabWin) {
    return;
  }

  tabMac.addEventListener('click', () => {
    setGuideTab('macos');
  });

  tabWin.addEventListener('click', () => {
    setGuideTab('windows');
  });
}

/**
 * Explicitly switch installation guide tab
 * @param {'macos' | 'windows'} osType
 */
function setGuideTab(osType) {
  const tabMac = document.getElementById('tabMac');
  const tabWin = document.getElementById('tabWin');
  const guideMac = document.getElementById('guideMac');
  const guideWin = document.getElementById('guideWin');

  if (!tabMac || !tabWin || !guideMac || !guideWin) {
    return;
  }

  if (osType === 'windows') {
    tabWin.classList.add('active');
    tabWin.setAttribute('aria-selected', 'true');
    guideWin.classList.add('active');

    tabMac.classList.remove('active');
    tabMac.setAttribute('aria-selected', 'false');
    guideMac.classList.remove('active');
  } else {
    // macos
    tabMac.classList.add('active');
    tabMac.setAttribute('aria-selected', 'true');
    guideMac.classList.add('active');

    tabWin.classList.remove('active');
    tabWin.setAttribute('aria-selected', 'false');
    guideWin.classList.remove('active');
  }
}

/**
 * Handle copy to clipboard with toast notification
 */
function initCopyButton() {
  const copyBtn = document.getElementById('copyCmdBtn');
  const cmdText = document.getElementById('cmdMacText');
  const toast = document.getElementById('toast');

  if (!copyBtn || !cmdText) {
    return;
  }

  let toastTimeoutId = null;

  copyBtn.addEventListener('click', async () => {
    const textToCopy = cmdText.textContent.trim();
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      showToast('터미널 명령어가 복사되었습니다!');
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('터미널 명령어가 복사되었습니다!');
    }
  });

  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
    }

    toastTimeoutId = setTimeout(() => {
      toast.classList.remove('show');
      toastTimeoutId = null;
    }, 2500);
  }
}
