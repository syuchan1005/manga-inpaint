import React from "react";
import { Sparkles } from "lucide-react";
import styles from "./Header.module.css";

export const Header: React.FC = () => {
  return (
    <header className={styles.header}>
      <div className={styles.tag}>
        <Sparkles size={12} />
        <span>Local WebGPU Inference</span>
      </div>
      <h1 className={styles.title}>Anime & Manga Inpaint</h1>
      <p className={styles.subtitle}>
        アニメや漫画特化のInpainting（LaMaベース）を、WebGPUを用いてブラウザ上で直接実行します。データは一切サーバーに送信されず、完全にローカルで完結します。
      </p>
    </header>
  );
};
