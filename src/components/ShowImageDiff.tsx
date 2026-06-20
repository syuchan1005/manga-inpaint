import React, { useState } from "react";
import { ImageSlider } from "./ImageSlider";
import { Columns, Layers, Eye, EyeOff } from "lucide-react";
import styles from "./ShowImageDiff.module.css";

interface ShowImageDiffProps {
  before: string;
  after: string;
  maskSrc?: string;
  className?: string;
  maxHeight?: string;
}

export const ShowImageDiff: React.FC<ShowImageDiffProps> = ({
  before,
  after,
  maskSrc,
  className = "",
  maxHeight = "70vh",
}) => {
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">(() => {
    try {
      const saved = localStorage.getItem("manga-inpaint-diff-mode");
      if (saved === "slider" || saved === "side-by-side") {
        return saved;
      }
    } catch (e) {
      console.warn("Failed to read from localStorage", e);
    }
    return "slider";
  });

  const [showMask, setShowMask] = useState(false);

  const handleModeChange = (mode: "slider" | "side-by-side") => {
    setViewMode(mode);
    try {
      localStorage.setItem("manga-inpaint-diff-mode", mode);
    } catch (e) {
      console.warn("Failed to write to localStorage", e);
    }
  };

  return (
    <div className={`${styles.diffViewer} ${className}`} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Mode Selector Toolbar */}
      <div className={styles.diffToolbar}>
        <div className={styles.diffTogglePill}>
          <button
            onClick={() => handleModeChange("slider")}
            className={`${styles.diffToggleBtn} ${viewMode === "slider" ? styles.active : ""}`}
            title="スライド比較"
          >
            <Layers size={14} />
            <span>スライド比較</span>
          </button>
          <button
            onClick={() => handleModeChange("side-by-side")}
            className={`${styles.diffToggleBtn} ${viewMode === "side-by-side" ? styles.active : ""}`}
            title="左右に並べる"
          >
            <Columns size={14} />
            <span>左右に並べる</span>
          </button>

          {maskSrc && (
            <>
              <div style={{ width: "1px", backgroundColor: "rgba(255, 255, 255, 0.15)", margin: "0.25rem 0.25rem" }} />
              <button
                onClick={() => setShowMask(!showMask)}
                className={`${styles.diffToggleBtn} ${showMask ? styles.active : ""}`}
                title={showMask ? "マスクを非表示" : "マスクを表示"}
              >
                {showMask ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>マスクを表示</span>
              </button>
            </>
          )}
        </div>
      </div>

      {viewMode === "slider" ? (
        <ImageSlider
          originalSrc={before}
          resultSrc={after}
          maskSrc={maskSrc}
          showMask={showMask}
          maxHeight={maxHeight}
        />
      ) : (
        <div className={styles.diffSideBySide}>
          {/* Left Column: Before */}
          <div className={styles.diffCol}>
            <div className={styles.labelsContainer} style={{ justifyContent: "center", marginBottom: "0.5rem" }}>
              <div className={styles.labelLeft}>
                Before (元画像)
              </div>
            </div>
            <div className={styles.canvasArea} style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}>
              <img
                src={before}
                alt="Before"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  maxHeight: maxHeight,
                  objectFit: "contain",
                  borderRadius: "0.375rem",
                }}
              />
              {showMask && maskSrc && (
                <img
                  src={maskSrc}
                  alt="Mask Overlay"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                    pointerEvents: "none",
                    objectFit: "contain",
                    opacity: 0.45,
                    borderRadius: "0.375rem",
                  }}
                />
              )}
            </div>
          </div>

          {/* Right Column: After */}
          <div className={styles.diffCol}>
            <div className={styles.labelsContainer} style={{ justifyContent: "center", marginBottom: "0.5rem" }}>
              <div className={styles.labelRight} style={{
                background: "linear-gradient(135deg, var(--color-rose) 0%, #ec4899 100%)"
              }}>
                After (処理後)
              </div>
            </div>
            <div className={styles.canvasArea} style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}>
              <img
                src={after}
                alt="After"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  maxHeight: maxHeight,
                  objectFit: "contain",
                  borderRadius: "0.375rem",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
