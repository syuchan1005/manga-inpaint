import React from "react";
import { X, Download } from "lucide-react";
import type { HistoryItem } from "../types";
import { ShowImageDiff } from "./ShowImageDiff";
import styles from "./HistoryModal.module.css";
import btnStyles from "./Button.module.css";

interface HistoryModalProps {
  activeHistoryItem: HistoryItem | null;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  activeHistoryItem,
  onClose,
}) => {
  if (!activeHistoryItem) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>履歴画像比較</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalBody}>
          <ShowImageDiff
            before={activeHistoryItem.originalSrc}
            after={activeHistoryItem.resultSrc}
            maskSrc={activeHistoryItem.maskSrc}
            maxHeight="calc(90vh - 280px)"
          />
        </div>
        <div className={styles.modalFooter}>
          <button
            onClick={() => {
              const a = document.createElement("a");
              a.href = activeHistoryItem.resultSrc;
              a.download = `inpainted_manga_${activeHistoryItem.id}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
            className={`${btnStyles.btn} ${btnStyles.btnSuccess}`}
          >
            <Download size={12} />
            <span>結果を保存</span>
          </button>
          <button
            onClick={onClose}
            className={`${btnStyles.btn} ${btnStyles.btnSecondary}`}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
