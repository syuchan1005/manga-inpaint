import React, { useState } from "react";
import { Cpu, Zap, Info, ChevronDown, ChevronUp } from "lucide-react";
import styles from "./ModelSelector.module.css";

interface ModelSelectorProps {
  isLoaded: boolean;
  isLoading: boolean;
  activeBackend: "webgpu" | "wasm" | null;
  lastInferenceTime: number | null;
  targetSize: number;
  setTargetSize: (size: number) => void;
  precision: "fp16" | "fp32";
  onPrecisionChange: (precision: "fp16" | "fp32") => void;
  originalWidth?: number;
  originalHeight?: number;
  inferenceMode: "single" | "patch";
  setInferenceMode: (mode: "single" | "patch") => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  isLoaded,
  isLoading,
  activeBackend,
  lastInferenceTime,
  targetSize,
  setTargetSize,
  precision,
  onPrecisionChange,
  originalWidth,
  originalHeight,
  inferenceMode,
  setInferenceMode,
}) => {
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    const saved = localStorage.getItem("manga-inpaint-model-selector-compact");
    return saved ? saved === "true" : false;
  });

  const toggleCompact = () => {
    setIsCompact((prev) => {
      const next = !prev;
      localStorage.setItem("manga-inpaint-model-selector-compact", String(next));
      return next;
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleArea}>
        <div className={styles.titleLeft}>
          <Cpu style={{ color: "var(--color-rose)" }} size={18} />
          <h3 className={styles.titleText}>AI推論モデル情報</h3>
          
          {isCompact && (
            <div className={styles.titleBadges}>
              {isLoading ? (
                <span className={`${styles.badge} ${styles.badgeLoading} ${styles.compactBadge}`}>読み込み中...</span>
              ) : isLoaded ? (
                <span className={`${styles.badge} ${styles.badgeLoaded} ${styles.compactBadge}`}>ロード完了</span>
              ) : (
                <span className={`${styles.badge} ${styles.compactBadge}`}>未ロード</span>
              )}

              {isLoaded && activeBackend && (
                <div className={`${styles.backendBadge} ${styles.compactBadge} ${activeBackend === "webgpu" ? styles.backendWebgpu : styles.backendWasm}`}>
                  <Zap size={8} style={{ marginRight: "0.1rem" }} />
                  <span>{activeBackend === "webgpu" ? "WebGPU" : "WASM"}</span>
                </div>
              )}

              {lastInferenceTime !== null && isLoaded && (
                <span className={styles.latencyBadge}>
                  {lastInferenceTime.toFixed(0)}ms
                </span>
              )}
            </div>
          )}
        </div>

        <button onClick={toggleCompact} className={styles.toggleButton} title={isCompact ? "詳細表示に切り替え" : "簡易表示に切り替え"}>
          <span>{isCompact ? "詳細表示" : "簡易表示"}</span>
          {isCompact ? <ChevronDown size={14} style={{ marginLeft: "0.2rem" }} /> : <ChevronUp size={14} style={{ marginLeft: "0.2rem" }} />}
        </button>
      </div>

      {isCompact ? (
        <div className={styles.compactContainer}>
          {/* Row 1: Selectors */}
          <div className={styles.compactRow}>
            {/* Precision Selector */}
            <div className={styles.compactCol}>
              <div className={styles.compactLabel}>モデル精度</div>
              <div className={styles.compactOptionsGrid}>
                {[
                  { value: "fp16" as const, label: "FP16 (高速)" },
                  { value: "fp32" as const, label: "FP32 (通常)" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onPrecisionChange(opt.value)}
                    className={`${styles.compactOptionButton} ${precision === opt.value ? styles.compactOptionButtonActive : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inference Mode Selector */}
            <div className={styles.compactCol}>
              <div className={styles.compactLabel}>推論モード</div>
              <div className={styles.compactOptionsGrid}>
                {[
                  { value: "single" as const, label: "全体一括" },
                  { value: "patch" as const, label: "分割" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setInferenceMode(opt.value)}
                    className={`${styles.compactOptionButton} ${inferenceMode === opt.value ? styles.compactOptionButtonActive : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Resolution Selector */}
          <div className={styles.compactCol} style={{ width: "100%" }}>
            <div className={styles.compactLabel}>
              推論解像度
              <span className={styles.compactSelectedValue}>
                : {targetSize === 0 ? (
                  originalWidth && originalHeight ? (
                    `オリジナル (${Math.ceil(Math.max(originalWidth, originalHeight) / 8) * 8} x ${Math.ceil(Math.max(originalWidth, originalHeight) / 8) * 8} px)`
                  ) : (
                    "オリジナル"
                  )
                ) : (
                  `${targetSize}px`
                )}
              </span>
            </div>
            <div className={styles.compactOptionsWrapGrid}>
              {[
                { size: 256, label: "256px" },
                { size: 384, label: "384px" },
                { size: 512, label: "512px" },
                { size: 768, label: "768px" },
                { size: 1024, label: "1024px" },
                { size: 0, label: "オリジナル" }
              ].map((opt) => (
                <button
                  key={opt.size}
                  onClick={() => setTargetSize(opt.size)}
                  className={`${styles.compactResButton} ${targetSize === opt.size ? styles.compactOptionButtonActive : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.infoCard}>
            <div className={styles.cardContent}>
              <div className={styles.modelName}>
                LaMa Manga ({precision === "fp16" ? "lama-manga-onnx-dynamic-fp16.onnx" : "lama-manga-onnx-dynamic.onnx"})
              </div>
              <div className={styles.modelDetails}>
                モデルサイズ: {precision === "fp16" ? "104 MB (超高速・軽量版)" : "206 MB (通常・高精度版)"}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              {/* Status Badge */}
              {isLoading ? (
                <span className={`${styles.badge} ${styles.badgeLoading}`}>モデル読み込み中...</span>
              ) : isLoaded ? (
                <span className={`${styles.badge} ${styles.badgeLoaded}`}>ロード完了</span>
              ) : (
                <span className={styles.badge}>未ロード</span>
              )}

              {/* Backend Badge */}
              {isLoaded && activeBackend && (
                <div className={`${styles.backendBadge} ${activeBackend === "webgpu" ? styles.backendWebgpu : styles.backendWasm}`}>
                  <Zap size={10} style={{ marginRight: "0.2rem" }} />
                  <span>{activeBackend === "webgpu" ? "WebGPU 高速化" : "WASM 推論"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Model Precision Selector Segmented Control */}
          <div className={styles.controlSection}>
            <div className={styles.controlHeader}>
              <div className={styles.sectionTitle}>モデル精度 (Model Precision)</div>
              <div className={styles.sectionValue}>{precision.toUpperCase()}</div>
            </div>
            <div className={styles.sectionDesc}>
              FP16はモデルサイズが半減し、スマホ等のGPU（WebGPU）で実行した際の速度が劇的に向上します。
            </div>
            <div className={styles.optionsGrid}>
              {[
                { value: "fp16" as const, label: "FP16 (軽量・高速)", desc: "約104MB / スマホ・WebGPU推奨" },
                { value: "fp32" as const, label: "FP32 (通常)", desc: "約206MB / 互換性重視" }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onPrecisionChange(opt.value)}
                  className={`${styles.optionButton} ${precision === opt.value ? styles.optionButtonActive : ""}`}
                >
                  <span className={styles.optionTitle}>{opt.label}</span>
                  <span className={styles.optionDesc}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Inference Mode Selector Segmented Control */}
          <div className={styles.controlSection}>
            <div className={styles.controlHeader}>
              <div className={styles.sectionTitle}>推論モード (Inference Mode)</div>
              <div className={styles.sectionValue}>
                {inferenceMode === "single" ? "全体一括推論" : "分割グループ推論"}
              </div>
            </div>
            <div className={styles.sectionDesc}>
              {inferenceMode === "single"
                ? "画像全体の解像度を変更して一括で推論します。全体的な文脈を維持するのに適しています。"
                : "マスク領域を検出し、部分的に切り抜いて低解像度で推論します。スクリーントーンの潰れを防ぎ高速です。"}
            </div>
            <div className={styles.optionsGrid}>
              {[
                { value: "single" as const, label: "全体一括 (Single)", desc: "画像を全体リサイズ" },
                { value: "patch" as const, label: "分割グループ (Patch)", desc: "マスク周辺を切り抜き" }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setInferenceMode(opt.value)}
                  className={`${styles.optionButton} ${inferenceMode === opt.value ? styles.optionButtonActive : ""}`}
                >
                  <span className={styles.optionTitle}>{opt.label}</span>
                  <span className={styles.optionDesc}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Resolution Selector Segmented Control */}
          <div className={styles.controlSection}>
            <div className={styles.controlHeader}>
              <div className={styles.sectionTitle}>推論解像度 (Inference Resolution)</div>
              <div className={styles.sectionValue}>
                {targetSize === 0 ? (
                  originalWidth && originalHeight ? (
                    `オリジナル (${Math.ceil(Math.max(originalWidth, originalHeight) / 8) * 8} x ${Math.ceil(Math.max(originalWidth, originalHeight) / 8) * 8} px)`
                  ) : (
                    "オリジナル解像度"
                  )
                ) : (
                  `${targetSize} x ${targetSize} px`
                )}
              </div>
            </div>
            <div className={styles.sectionDesc}>
              解像度を下げると速度が向上します。PC・GPU環境では高精細な768px/1024pxやオリジナル解像度も選択可能です。
            </div>
            <div className={styles.optionsWrapGrid}>
              {[
                { size: 256, label: "高速 (256px)", desc: "スマホ推奨 / 超高速" },
                { size: 384, label: "標準 (384px)", desc: "バランス良好" },
                { size: 512, label: "高画質 (512px)", desc: "PC推奨 / 精細" },
                { size: 768, label: "超高画質 (768px)", desc: "PC推奨 / 高負荷" },
                { size: 1024, label: "極限 (1024px)", desc: "PC推奨 / 超高負荷" },
                { size: 0, label: "オリジナル", desc: "画像サイズ / 負荷注意" }
              ].map((opt) => (
                <button
                  key={opt.size}
                  onClick={() => setTargetSize(opt.size)}
                  className={`${styles.optionButton} ${styles.resButton} ${targetSize === opt.size ? styles.optionButtonActive : ""}`}
                >
                  <span className={styles.optionTitle}>{opt.label}</span>
                  <span className={styles.optionDesc}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Latency Info Banner */}
          {lastInferenceTime !== null && isLoaded && (
            <div className={styles.infoBanner}>
              <Info size={14} style={{ color: "var(--color-rose)", marginRight: "0.5rem" }} />
              <span>
                前回の推論時間:{" "}
                <span className={styles.highlightText}>
                  {lastInferenceTime.toFixed(1)}ms
                </span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
