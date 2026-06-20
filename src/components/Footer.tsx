import React from "react";
import { Info, ShieldAlert } from "lucide-react";
import styles from "./Footer.module.css";

export const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <p className={styles.footerRow}>
        <Info size={12} style={{ color: "var(--text-secondary)" }} />
        <span>初回起動時はモデルのダウンロードに数十秒かかります。</span>
      </p>
      <p className={`${styles.footerRow} ${styles.footerRowSub}`}>
        <ShieldAlert size={10} style={{ color: "var(--text-muted)" }} />
        <span>モバイル端末の場合、WebGPUが有効になっていることを確認してください。</span>
      </p>
      <p style={{ marginTop: "1rem", opacity: 0.3, fontSize: "0.6rem" }}>
        Powered by ONNX Runtime Web WebGPU & LaMa Manga | <a href="https://github.com/syuchan1005/manga-inpaint" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>GitHub</a>
      </p>
    </footer>
  );
};
