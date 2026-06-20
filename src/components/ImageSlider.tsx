import React, { useState, useRef, useEffect, useCallback } from "react";
import { MoveHorizontal } from "lucide-react";
import styles from "./ImageSlider.module.css";

interface ImageSliderProps {
  originalSrc: string;
  resultSrc: string;
  maskSrc?: string;
  showMask?: boolean;
  className?: string;
  maxHeight?: string;
}

export const ImageSlider: React.FC<ImageSliderProps> = ({
  originalSrc,
  resultSrc,
  maskSrc,
  showMask = false,
  className = "",
  maxHeight = "70vh",
}) => {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  }, [isDragging, handleMove]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  }, [isDragging, handleMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleTouchMove, handleMouseUp]);

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };


  return (
    <div className={`${styles.sliderWrapper} ${className}`} style={{ width: "100%", display: "flex", flexDirection: "column" }}>
      {/* Before / After Labels Container (Outside the image) */}
      <div className={styles.labelsContainer}>
        <div className={styles.labelLeft}>
          Before (元画像)
        </div>
        <div className={styles.labelRight}>
          After (処理後)
        </div>
      </div>

      <div
        ref={containerRef}
        className={styles.canvasArea}
        style={{ cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", touchAction: "none" }}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
      >
        {/* Original Image (Left Side background) */}
        <img
          src={originalSrc}
          alt="Original"
          style={{ width: "100%", height: "auto", display: "block", pointerEvents: "none", maxHeight: maxHeight, objectFit: "contain" }}
        />

        {/* Mask Overlay (clipped to before/left side of slider) */}
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
              clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
            }}
          />
        )}

        {/* Inpainted Image (Right Side clipped) */}
        <img
          src={resultSrc}
          alt="Inpainted"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "block",
            pointerEvents: "none",
            objectFit: "contain",
            clipPath: `inset(0 0 0 ${sliderPos}%)`,
          }}
        />

        {/* Slider Line & Handle */}
        <div
          className={styles.line}
          style={{ left: `${sliderPos}%` }}
        >
          <div className={styles.handle}>
            <MoveHorizontal size={14} />
          </div>
        </div>
      </div>
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
        スライダーを左右にドラッグして結果を比較できます
      </p>
    </div>
  );
};
