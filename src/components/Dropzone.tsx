import React, { useState } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import styles from "./Dropzone.module.css";
import btnStyles from "./Button.module.css";

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  onSampleSelect: () => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelect,
  onSampleSelect,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onFileSelect(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div
      className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={isDragOver ? { borderColor: "var(--color-rose)", backgroundColor: "rgba(15, 23, 42, 0.25)" } : {}}
    >
      <div className={styles.dropzoneIcon}>
        <Upload size={32} />
      </div>
      <h3 className={styles.dropzoneTitle}>画像をアップロード</h3>
      <p className={styles.dropzoneDesc}>
        ドラッグ＆ドロップするか、ファイルを選択してください。
        （JPG, PNGなど、透過画像も対応）
      </p>

      <div className={styles.dropzoneBtns}>
        <label className={`${btnStyles.btn} ${btnStyles.btnPrimary}`} style={{ cursor: "pointer" }}>
          <Upload size={14} />
          ファイルを選択
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>

        <button
          onClick={onSampleSelect}
          className={`${btnStyles.btn} ${btnStyles.btnSecondary}`}
        >
          <ImageIcon size={14} />
          サンプル画像を使用
        </button>
      </div>
    </div>
  );
};
