import React, { useEffect } from "react";
import { RefreshCw, CheckCircle } from "lucide-react";
import type { DownloadProgress } from "../lib/inference";
import styles from "./ToastAlert.module.css";

interface ToastAlertProps {
  isProcessing: boolean;
  progressMsg: string;
  downloadProgress: DownloadProgress | null;
  onClearMsg: () => void;
}

export const ToastAlert: React.FC<ToastAlertProps> = ({
  isProcessing,
  progressMsg,
  downloadProgress,
  onClearMsg,
}) => {
  // If it's a completion message, auto-dismiss it after 4 seconds
  useEffect(() => {
    if (!isProcessing && progressMsg && progressMsg.includes("完了")) {
      const timer = setTimeout(() => {
        onClearMsg();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isProcessing, progressMsg, onClearMsg]);

  if (!progressMsg) return null;

  if (isProcessing) {
    return (
      <div className={styles.toast}>
        <RefreshCw size={16} className={styles.animateSpin} style={{ color: "var(--color-rose)" }} />
        <div>
          <div className={styles.toastTitle}>ステータス</div>
          <div className={styles.toastDesc}>
            {progressMsg}
            {downloadProgress && ` (${downloadProgress.progress.toFixed(0)}%)`}
          </div>
        </div>
      </div>
    );
  }

  if (progressMsg.includes("完了")) {
    return (
      <div className={`${styles.toast} ${styles.toastSuccess}`}>
        <CheckCircle size={16} style={{ color: "var(--color-emerald)" }} />
        <div>
          <div className={styles.toastTitle}>完了</div>
          <div className={styles.toastDesc}>{progressMsg}</div>
        </div>
      </div>
    );
  }

  // Any other error or warning messages could also be shown here
  return (
    <div className={styles.toast}>
      <CheckCircle size={16} style={{ color: "var(--color-rose)" }} />
      <div>
        <div className={styles.toastTitle}>情報</div>
        <div className={styles.toastDesc}>{progressMsg}</div>
      </div>
    </div>
  );
};
