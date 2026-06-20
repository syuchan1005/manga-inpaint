import React from "react";
import { History, Download, Trash2 } from "lucide-react";
import type { HistoryItem } from "../types";
import styles from "./HistorySection.module.css";
import btnStyles from "./Button.module.css";

interface HistorySectionProps {
  history: HistoryItem[];
  onDelete: (id: string) => void;
  onSelectCompare: (item: HistoryItem) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  history,
  onDelete,
  onSelectCompare,
}) => {
  if (history.length === 0) return null;

  return (
    <div className={styles.historyCardWrapper}>
      <h3 className={styles.historyTitle}>
        <History size={16} />
        <span>処理履歴 ({history.length}件)</span>
      </h3>
      <div className={styles.historyGrid}>
        {history.map((item, index) => (
          <div key={item.id} className={styles.historyCard}>
            <div className={styles.thumbContainer}>
              <img
                src={item.resultSrc}
                alt={`History ${index}`}
                className={styles.thumb}
              />
              <div className={styles.cardOverlay}>
                <button
                  onClick={() => onSelectCompare(item)}
                  className={`${btnStyles.btn} ${btnStyles.btnPrimary} ${btnStyles.btnSm}`}
                >
                  スライド比較
                </button>
              </div>
            </div>
            
            <div className={styles.cardFooter}>
              <div className={styles.cardHeaderRow}>
                <span className={styles.cardLabel}>
                  履歴 #{history.length - index}
                </span>
                <span className={styles.cardTime}>
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>

              {/* Parameters Used */}
              <div className={styles.paramsBox}>
                <div className={styles.paramRow}>
                  <span>モード:</span>
                  <span
                    className={
                      item.inferenceMode === "patch"
                        ? styles.paramValueHighlight
                        : styles.paramValue
                    }
                  >
                    {item.inferenceMode === "patch" ? "分割" : "全体"}
                  </span>
                </div>
                <div className={styles.paramRow}>
                  <span>解像度:</span>
                  <span className={styles.paramValue}>
                    {item.targetSize === 0 ? "オリジナル" : `${item.targetSize}px`}
                  </span>
                </div>
                <div className={styles.paramRow}>
                  <span>精度:</span>
                  <span className={styles.paramValue}>
                    {item.precision.toUpperCase()}
                  </span>
                </div>
                {item.inferenceTimeMs !== null && (
                  <div className={styles.inferenceTimeRow}>
                    <span>推論時間:</span>
                    <span className={styles.inferenceTimeValue}>
                      {item.inferenceTimeMs.toFixed(0)}ms
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.actionRow}>
                <span style={{ fontSize: "0.6rem", opacity: 0.5 }}></span>
                <div className={styles.actionsGroup}>
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = item.resultSrc;
                      a.download = `inpainted_manga_${item.id}.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className={styles.actionBtn}
                    title="ダウンロード"
                  >
                    <Download size={12} />
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                    title="削除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
