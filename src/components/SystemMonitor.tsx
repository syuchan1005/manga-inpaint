import React from "react";
import type { DownloadProgress } from "../lib/inference";
import styles from "./SystemMonitor.module.css";

interface SystemMonitorProps {
  isWebGPUSupported: boolean;
  gpuInfo: string | null;
  downloadProgress: DownloadProgress | null;
  showDebugPanel: boolean;
  setShowDebugPanel: (show: boolean) => void;
}

export const SystemMonitor: React.FC<SystemMonitorProps> = ({
  isWebGPUSupported,
  gpuInfo,
  downloadProgress,
  showDebugPanel,
  setShowDebugPanel,
}) => {
  return (
    <div className={styles.systemMonitor}>
      {/* Hardware info */}
      <div className={styles.hardwareInfo}>
        <span className={styles.hardwareLabel}>GPU / ハードウェア:</span>
        {isWebGPUSupported ? (
          <span className={`${styles.statusText} ${styles.statusTextWebgpu}`}>
            <span className={`${styles.dot} ${styles.dotWebgpu}`}></span>
            WebGPU アクセラレーション有効 ({gpuInfo})
          </span>
        ) : (
          <span className={`${styles.statusText} ${styles.statusTextWasm}`}>
            <span className={`${styles.dot} ${styles.dotWasm}`}></span>
            WASM フォールバック ({gpuInfo})
          </span>
        )}
      </div>

      {/* Model Download progress */}
      {downloadProgress && (
        <div className={styles.progressContainer}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>モデルダウンロード中:</span>
            <span>
              {downloadProgress.progress.toFixed(0)}% ({(downloadProgress.loaded / 1024 / 1024).toFixed(1)}MB / {(downloadProgress.total / 1024 / 1024).toFixed(1)}MB)
            </span>
          </div>
          <div className={styles.progressBarTrack}>
            <div
              className={styles.progressBarFill}
              style={{ width: `${downloadProgress.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Debug Panel Toggle */}
      <div className={styles.debugToggle}>
        <input
          type="checkbox"
          id="debug-panel-toggle"
          checked={showDebugPanel}
          onChange={(e) => setShowDebugPanel(e.target.checked)}
          className={styles.checkbox}
        />
        <label
          htmlFor="debug-panel-toggle"
          className={`${styles.checkboxLabel} ${
            showDebugPanel ? styles.checkboxLabelActive : styles.checkboxLabelInactive
          }`}
        >
          入力デバッグ表示
        </label>
      </div>
    </div>
  );
};
