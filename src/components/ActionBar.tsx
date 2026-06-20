import React from "react";
import { RefreshCw, Upload, ChevronRight, Sparkles, Download } from "lucide-react";
import styles from "./ActionBar.module.css";
import btnStyles from "./Button.module.css";

interface ActionBarProps {
  onReset: () => void;
  onReplaceImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hasResult: boolean;
  showComparison: boolean;
  onToggleComparison: () => void;
  onInpaint: () => void;
  isProcessing: boolean;
  onDownload: () => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onReset,
  onReplaceImage,
  hasResult,
  showComparison,
  onToggleComparison,
  onInpaint,
  isProcessing,
  onDownload,
}) => {
  return (
    <div className={styles.actionBar}>
      <div className={styles.leftGroup}>
        <button
          onClick={onReset}
          className={`${btnStyles.btn} ${btnStyles.btnSecondary}`}
        >
          <RefreshCw size={12} />
          別画像を選択
        </button>

        <label className={`${btnStyles.btn} ${btnStyles.btnSecondary}`} style={{ cursor: "pointer" }}>
          <Upload size={12} />
          <span>画像を差し替え (マスク維持)</span>
          <input
            type="file"
            accept="image/*"
            onChange={onReplaceImage}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <div className={styles.rightGroup}>
        {hasResult && (
          <button
            onClick={onToggleComparison}
            className={`${btnStyles.btn} ${btnStyles.btnSecondary}`}
          >
            <span>{showComparison ? "マスク編集に戻る" : "結果を比較"}</span>
            <ChevronRight size={12} style={{ marginLeft: "0.25rem" }} />
          </button>
        )}

        {!showComparison ? (
          <button
            onClick={onInpaint}
            disabled={isProcessing}
            className={`${btnStyles.btn} ${btnStyles.btnPrimary}`}
          >
            {isProcessing ? (
              <RefreshCw size={12} className={styles.animateSpin} />
            ) : (
              <Sparkles size={12} />
            )}
            <span>{isProcessing ? "実行中..." : "インペイント実行"}</span>
          </button>
        ) : (
          <button
            onClick={onDownload}
            className={`${btnStyles.btn} ${btnStyles.btnSuccess}`}
          >
            <Download size={12} />
            <span>結果を保存</span>
          </button>
        )}
      </div>
    </div>
  );
};
