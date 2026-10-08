import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

interface NetworkStatusPayload {
  is_online: boolean;
}

type NetworkListener = (isOnline: boolean) => void;

class NetworkManager {
  private static instance: NetworkManager;
  private currentOnline: boolean = typeof navigator !== "undefined" ? navigator.onLine : true;
  private listeners: Set<NetworkListener> = new Set();
  private unlistenTauriEvent: UnlistenFn | null = null;
  private isChecking: boolean = false;

  private constructor() {
    if (typeof window !== "undefined") {
      this.init();
    }
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private async init() {
    // 1. 초기 1회 백엔드 소켓 검증 (공유기 연결 + WAN 단절 상태 정확 판정)
    this.checkNow();

    // 2. Tauri 백엔드의 OS 네이티브 네트워크 알림 구독 (Zero-Polling)
    try {
      this.unlistenTauriEvent = await listen<NetworkStatusPayload>(
        "network-status-changed",
        (event) => {
          this.updateStatus(event.payload.is_online);
        }
      );
    } catch (err) {
      console.warn("[NetworkManager] Tauri 이벤트 리스너 등록 실패 (브라우저 폴백):", err);
    }

    // 3. 브라우저 레벨 기본 이벤트 보조 구독
    window.addEventListener("online", () => {
      // 브라우저가 온라인을 감지했을 때 실제 외부 인터넷 도달 여부 1회 확인
      this.checkNow();
    });

    window.addEventListener("offline", () => {
      this.updateStatus(false);
    });

    // 4. 창 복귀 시(window.focus) 1회 지연 확인 (Lazy Check)
    window.addEventListener("focus", () => {
      this.checkNow();
    });
  }

  /**
   * 현재 인터넷 연결 여부 (SSOT)
   */
  public get isOnline(): boolean {
    return this.currentOnline;
  }

  /**
   * 상태 변경 리스너 구독
   */
  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    // 등록 즉시 현재 상태 1회 전달
    listener(this.currentOnline);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 실제 네트워크 통신(웹폰트 fetch, 메타데이터 fetch 등) 실패 시
   * 외부 인터넷 불가(WAN 단절/캡티브 포털 등) 상태로 즉시 반응형 전환
   */
  public reportNetworkFailure() {
    if (this.currentOnline) {
      console.warn("[NetworkManager] 실제 네트워크 요청 실패 감지 -> 오프라인으로 전환");
      this.updateStatus(false);
    }
  }

  /**
   * 온디맨드 1회 소켓 레벨 인터넷 연결 검증
   */
  public async checkNow(): Promise<boolean> {
    if (this.isChecking) return this.currentOnline;
    this.isChecking = true;

    try {
      const isConnected = await invoke<boolean>("check_network_connectivity");
      this.updateStatus(isConnected);
      return isConnected;
    } catch {
      // Tauri invoke 불가 환경(일반 웹)에서는 navigator.onLine으로 폴백
      const fallback = typeof navigator !== "undefined" ? navigator.onLine : false;
      this.updateStatus(fallback);
      return fallback;
    } finally {
      this.isChecking = false;
    }
  }

  private updateStatus(newStatus: boolean) {
    if (this.currentOnline !== newStatus) {
      this.currentOnline = newStatus;
      console.log(`[NetworkManager] 네트워크 상태 갱신: isOnline = ${newStatus}`);
      for (const listener of this.listeners) {
        try {
          listener(newStatus);
        } catch (e) {
          console.error("[NetworkManager] 리스너 호출 에러:", e);
        }
      }
    }
  }

  public destroy() {
    if (this.unlistenTauriEvent) {
      this.unlistenTauriEvent();
      this.unlistenTauriEvent = null;
    }
    this.listeners.clear();
  }
}

export const networkManager = NetworkManager.getInstance();
