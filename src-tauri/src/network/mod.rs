use std::net::{SocketAddr, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::time::{Duration, Instant};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "windows")]
pub mod windows;

const DEBOUNCE_DURATION: Duration = Duration::from_millis(1000);
const SOCKET_TIMEOUT: Duration = Duration::from_millis(2000);

static IS_ONLINE_CACHED: AtomicBool = AtomicBool::new(true);

#[derive(Clone, Debug, Serialize)]
pub struct NetworkStatusPayload {
    pub is_online: bool,
}

/**
 * 공유기(LAN) 연결 여부와 상관없이 실제 외부 인터넷(WAN) 통신 가능 여부를 검증합니다.
 * 포트 53(DNS) TCP 차단 환경(기업망/공유기)을 고려하여 포트 443(HTTPS) 및 53을 모두 검증합니다.
 */
pub fn check_internet_connectivity() -> bool {
    let addrs: [SocketAddr; 5] = [
        "1.1.1.1:443".parse().unwrap(),
        "8.8.8.8:443".parse().unwrap(),
        "1.1.1.1:53".parse().unwrap(),
        "8.8.8.8:53".parse().unwrap(),
        "223.5.5.5:443".parse().unwrap(),
    ];

    for addr in &addrs {
        if TcpStream::connect_timeout(addr, SOCKET_TIMEOUT).is_ok() {
            IS_ONLINE_CACHED.store(true, Ordering::SeqCst);
            return true;
        }
    }

    IS_ONLINE_CACHED.store(false, Ordering::SeqCst);
    false
}

pub fn get_cached_online_status() -> bool {
    IS_ONLINE_CACHED.load(Ordering::SeqCst)
}

/**
 * OS 네이티브 네트워크 알림 모니터를 백그라운드에 구동합니다.
 * OS가 상태 변경을 알릴 때마다 1,000ms 디바운스를 거쳐 최종 상태를 확정하고 Tauri 프론트엔드로 emit합니다.
 */
pub fn start_network_monitor(app_handle: AppHandle) {
    let initial_status = check_internet_connectivity();
    IS_ONLINE_CACHED.store(initial_status, Ordering::SeqCst);
    eprintln!("[NetworkMonitor] 초기 인터넷 연결 상태: {}", initial_status);

    let (trigger_tx, trigger_rx): (Sender<()>, Receiver<()>) = channel();

    // OS 네이티브 리스너 등록
    #[cfg(target_os = "macos")]
    {
        if let Err(e) = macos::start_macos_network_listener(trigger_tx.clone()) {
            eprintln!("[NetworkMonitor] macOS 네이티브 리스너 시작 실패: {}", e);
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Err(e) = windows::start_windows_network_listener(trigger_tx.clone()) {
            eprintln!("[NetworkMonitor] Windows 네이티브 리스너 시작 실패: {}", e);
        }
    }

    // 1,000ms 디바운스 워커 스레드 (Flapping 방어)
    let app_handle_clone = app_handle.clone();
    std::thread::Builder::new()
        .name("network-debounce-worker".to_string())
        .spawn(move || {
            let mut last_status = initial_status;

            loop {
                // 첫 번째 알림 수신 (블로킹 대기 - CPU 0%, 트래픽 0%)
                if trigger_rx.recv().is_err() {
                    break;
                }

                // 1,000ms 동안 후속 이벤트가 오는지 모니터링 (디바운스)
                let mut debounce_until = Instant::now() + DEBOUNCE_DURATION;
                loop {
                    let now = Instant::now();
                    if now >= debounce_until {
                        break;
                    }
                    let remaining = debounce_until - now;
                    match trigger_rx.recv_timeout(remaining) {
                        Ok(()) => {
                            // 추가 이벤트 발생 시 디바운스 타이머 리셋
                            debounce_until = Instant::now() + DEBOUNCE_DURATION;
                        }
                        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                            // 1,000ms 동안 추가 이벤트 없이 안정화됨
                            break;
                        }
                        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                            return;
                        }
                    }
                }

                // 안정화 후 실제 인터넷 도달 여부 최종 검증
                let current_status = check_internet_connectivity();
                eprintln!(
                    "[NetworkMonitor] 안정화 후 상태 검증: 이전={}, 현재={}",
                    last_status, current_status
                );

                if current_status != last_status {
                    last_status = current_status;
                    let payload = NetworkStatusPayload {
                        is_online: current_status,
                    };
                    if let Err(e) = app_handle_clone.emit("network-status-changed", payload) {
                        eprintln!("[NetworkMonitor] Tauri 이벤트 emit 실패: {:?}", e);
                    } else {
                        eprintln!(
                            "[NetworkMonitor] network-status-changed 이벤트 전송 완료 (is_online={})",
                            current_status
                        );
                    }
                }
            }
        })
        .expect("네트워크 디바운스 워커 스레드 생성 실패");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_internet_connectivity() {
        let connected = check_internet_connectivity();
        println!("test_check_internet_connectivity result: {}", connected);
        assert!(connected);
    }
}
