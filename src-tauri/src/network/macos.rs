#[cfg(target_os = "macos")]
use std::sync::mpsc::Sender;
use system_configuration::core_foundation::runloop::{kCFRunLoopDefaultMode, CFRunLoop};
use system_configuration::network_reachability::{
    ReachabilityFlags, SCNetworkReachability,
};

pub fn start_macos_network_listener(trigger_tx: Sender<()>) -> Result<(), String> {
    std::thread::Builder::new()
        .name("macos-network-listener".to_string())
        .spawn(move || {
            let host_cstr = c"fonts.google.com";

            let mut reachability = match SCNetworkReachability::from_host(host_cstr) {
                Some(r) => r,
                None => {
                    eprintln!("[NetworkMonitor:macOS] SCNetworkReachability 생성 실패");
                    return;
                }
            };

            let tx = trigger_tx.clone();
            let callback = move |_flags: ReachabilityFlags| {
                let _ = tx.send(());
            };

            if let Err(e) = reachability.set_callback(callback) {
                eprintln!("[NetworkMonitor:macOS] 콜백 등록 실패: {:?}", e);
                return;
            }

            let current_loop = CFRunLoop::get_current();
            let scheduled = unsafe {
                reachability.schedule_with_runloop(&current_loop, kCFRunLoopDefaultMode)
            };
            if let Err(e) = scheduled {
                eprintln!("[NetworkMonitor:macOS] RunLoop 스케줄링 실패: {:?}", e);
                return;
            }

            eprintln!("[NetworkMonitor:macOS] OS 네이티브 네트워크 알림 구독 시작 (Zero-Polling)");
            CFRunLoop::run_current();
        })
        .map_err(|e| format!("네트워크 감시 스레드 생성 실패: {}", e))?;

    Ok(())
}
