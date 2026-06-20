import React from "react";
import { Info } from "lucide-react";
import styles from "./DebugPanel.module.css";

interface DebugPanelProps {
  showDebugPanel: boolean;
  targetSize: number;
  debugMaskUrls: string[];
  debugInputImageUrls: string[];
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  showDebugPanel,
  targetSize,
  debugMaskUrls,
  debugInputImageUrls,
}) => {
  if (!showDebugPanel) return null;

  return (
    <div className={styles.debugCard}>
      <h3 className={styles.titleArea}>
        <Info size={14} />
        <span>
          モデル入力デバッグプレビュー ({targetSize === 0 ? "可変" : `${targetSize}x${targetSize}`})
        </span>
      </h3>
      <p className={styles.descText}>
        インペイント実行時に生成され、モデルへ直接供給されるFloat32テンソルのビジュアル確認用プレビューです。
      </p>
      
      <div className={styles.grid}>
        {debugMaskUrls.map((maskUrl, idx) => (
          <div key={idx} className={styles.patchCard}>
            <span className={styles.patchTitle}>
              {debugMaskUrls.length > 1 ? `グループ #${idx + 1}` : "入力データ"}
            </span>
            <div className={styles.patchImages}>
              <div className={styles.patchImageCol}>
                <span className={styles.patchImageLabel}>マスク (mask)</span>
                <img
                  src={maskUrl}
                  alt={`Input Mask ${idx + 1}`}
                  className={styles.previewImg}
                />
              </div>
              <div className={styles.patchImageCol}>
                <span className={styles.patchImageLabel}>画像 (image)</span>
                <img
                  src={debugInputImageUrls[idx]}
                  alt={`Input Image ${idx + 1}`}
                  className={styles.previewImg}
                />
              </div>
            </div>
          </div>
        ))}
        {debugMaskUrls.length === 0 && (
          <div className={styles.emptyState}>
            推論実行後に表示されます
          </div>
        )}
      </div>
    </div>
  );
};
