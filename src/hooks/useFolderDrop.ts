import { useEffect, useState, useRef } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { tauriDragDropEventPayloadSchema } from "../schemas";

interface UseFolderDropOptions {
  onDropPaths: (paths: string[]) => void | Promise<void>;
  enabled?: boolean;
}

export function useFolderDrop({ onDropPaths, enabled = true }: UseFolderDropOptions) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const onDropPathsRef = useRef(onDropPaths);

  useEffect(() => {
    onDropPathsRef.current = onDropPaths;
  }, [onDropPaths]);

  // 1. 브라우저 기본 드래그 앤 드롭 파일 열기 방지
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);

    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  // 2. Tauri Webview 드래그 앤 드롭 이벤트 리스너 등록
  useEffect(() => {
    if (!enabled) return;

    let unlisten: (() => void) | undefined;
    let isSubscribed = true;

    async function setupDragDrop() {
      try {
        const webview = getCurrentWebview();
        const unlistenFn = await webview.onDragDropEvent((event) => {
          if (!isSubscribed) return;

          const parsed = tauriDragDropEventPayloadSchema.safeParse(event.payload);
          if (!parsed.success) return;

          const payload = parsed.data;
          if (payload.type === "enter" || payload.type === "over") {
            setIsDraggingOver(true);
          } else if (payload.type === "drop") {
            setIsDraggingOver(false);
            if (payload.paths.length > 0) {
              void onDropPathsRef.current(payload.paths);
            }
          } else if (payload.type === "leave") {
            setIsDraggingOver(false);
          }
        });

        if (isSubscribed) {
          unlisten = unlistenFn;
        } else {
          unlistenFn();
        }
      } catch (err) {
        console.error("[useFolderDrop] Failed to attach drag drop listener:", err);
      }
    }

    void setupDragDrop();

    return () => {
      isSubscribed = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [enabled]);

  return { isDraggingOver, setIsDraggingOver };
}
