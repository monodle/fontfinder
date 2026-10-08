#[cfg(target_os = "windows")]
use std::sync::mpsc::Sender;
#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0};
#[cfg(target_os = "windows")]
use windows_sys::Win32::NetworkManagement::IpHelper::NotifyAddrChange;
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::IO::OVERLAPPED;
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Threading::{CreateEventW, WaitForSingleObject, INFINITE};

#[cfg(target_os = "windows")]
pub fn start_windows_network_listener(trigger_tx: Sender<()>) -> Result<(), String> {
    std::thread::Builder::new()
        .name("windows-network-listener".to_string())
        .spawn(move || unsafe {
            let event: HANDLE = CreateEventW(std::ptr::null(), 0, 0, std::ptr::null());
            if event.is_null() {
                eprintln!("[NetworkMonitor:Windows] 이벤트 핸들 생성 실패");
                return;
            }

            eprintln!("[NetworkMonitor:Windows] OS 네이티브 네트워크 알림 구독 시작 (Zero-Polling)");

            loop {
                let mut overlapped: OVERLAPPED = std::mem::zeroed();
                overlapped.hEvent = event;
                let mut notify_handle: HANDLE = std::ptr::null_mut();
                let status = NotifyAddrChange(&mut notify_handle, &overlapped);
                if status != 0 && status != 997 { // 0: NO_ERROR, 997: ERROR_IO_PENDING
                    eprintln!("[NetworkMonitor:Windows] NotifyAddrChange 실패 (에러코드: {})", status);
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    continue;
                }

                let wait_res = WaitForSingleObject(event, INFINITE);
                if wait_res == WAIT_OBJECT_0 {
                    let _ = trigger_tx.send(());
                } else {
                    break;
                }
            }

            CloseHandle(event);
        })
        .map_err(|e| format!("Windows 네트워크 감시 스레드 생성 실패: {}", e))?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn start_windows_network_listener(_trigger_tx: std::sync::mpsc::Sender<()>) -> Result<(), String> {
    Ok(())
}
