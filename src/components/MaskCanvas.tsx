import React, { useRef, useState, useEffect, useCallback } from "react";
import { Brush, Trash2, RotateCcw, Paintbrush, Eraser } from "lucide-react";
import styles from "./MaskCanvas.module.css";
import btnStyles from "./Button.module.css";

interface MaskCanvasProps {
  imageSrc: string;
  onImageLoad: (img: HTMLImageElement) => void;
  maskCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  brushSize: number;
  setBrushSize: (size: number) => void;
  isEraser: boolean;
  setIsEraser: (val: boolean) => void;
}

export const MaskCanvas: React.FC<MaskCanvasProps> = ({
  imageSrc,
  onImageLoad,
  maskCanvasRef,
  brushSize,
  setBrushSize,
  isEraser,
  setIsEraser,
}) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const prevImageSrcRef = useRef<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(0);

  // When image loads, update container and canvas size
  const handleImageLoaded = useCallback(() => {
    if (imageRef.current) {
      const img = imageRef.current;
      onImageLoad(img);
      
      const canvas = maskCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        
        // 画像が本当に変更された（または初めてロードされた）場合のみ実行
        if (prevImageSrcRef.current !== imageSrc) {
          // null や空文字からのロードではなく、すでに画像があった状態からの変更＝差し替え
          const isReplacing = prevImageSrcRef.current !== null && prevImageSrcRef.current !== "";
          prevImageSrcRef.current = imageSrc;

          if (isReplacing && ctx) {
            // --- マスクの維持＆リサイズ転写処理 ---
            // 1. 現在のキャンバスの内容を一時的なキャンバスにコピーして退避
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext("2d");
            if (tempCtx) {
              tempCtx.drawImage(canvas, 0, 0);
            }
            
            // 2. キャンバスサイズを新しい画像サイズに更新（これでクリアされる）
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            setCanvasWidth(canvas.width);
            
            // 3. 退避したマスクを新しいサイズに合わせて引き伸ばし描画
            ctx.globalCompositeOperation = "source-over";
            ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);
            
            // 4. Undoスタックを再初期化（現在のリサイズされたマスクを初期状態とする）
            const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setUndoStack([state]);
          } else {
            // --- 新規ロード処理 ---
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            setCanvasWidth(canvas.width);
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              setUndoStack([initialData]);
            }
          }
        }
      }
    }
  }, [imageSrc, maskCanvasRef, onImageLoad]);

  useEffect(() => {
    if (!imageSrc) {
      prevImageSrcRef.current = null;
    } else if (imageRef.current && imageRef.current.complete) {
      handleImageLoaded();
    }
  }, [imageSrc, handleImageLoaded]);

  const saveState = () => {
    const canvas = maskCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setUndoStack((prev) => [...prev.slice(-9), state]);
      }
    }
  };

  const undo = () => {
    if (undoStack.length > 1) {
      const newStack = [...undoStack];
      newStack.pop();
      const prevState = newStack[newStack.length - 1];
      
      const canvas = maskCanvasRef.current;
      if (canvas && prevState) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.putImageData(prevState, 0, 0);
          setUndoStack(newStack);
        }
      }
    }
  };

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveState();
      }
    }
  };

  const getCoordinates = (
    clientX: number,
    clientY: number
  ): { x: number; y: number } | null => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const coords = getCoordinates(clientX, clientY);
    if (!coords) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    
    if (isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(244, 63, 94, 1.0)";
    }
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const coords = getCoordinates(clientX, clientY);
    if (!coords) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    draw(e);
    const canvas = maskCanvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCanvasRect(rect);
      setCursorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    const canvas = maskCanvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCanvasRect(rect);
      setCursorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseLeave = () => {
    setCursorPos(null);
    stopDrawing();
  };

  return (
    <div className={styles.container}>
      {/* Drawing Controls */}
      <div className={styles.controls}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setIsEraser(false)}
            className={`${btnStyles.btn} ${!isEraser ? btnStyles.btnPrimary : btnStyles.btnSecondary}`}
          >
            <Paintbrush size={14} />
            <span>ペン</span>
          </button>
          <button
            onClick={() => setIsEraser(true)}
            className={`${btnStyles.btn} ${isEraser ? btnStyles.btnPrimary : btnStyles.btnSecondary}`}
            style={isEraser ? { background: "var(--text-primary)", color: "var(--bg-dark)" } : {}}
          >
            <Eraser size={14} />
            <span>消しゴム</span>
          </button>
        </div>

        {/* Brush Size Slider */}
        <div className={styles.brushSlider}>
          <Brush size={14} style={{ color: "var(--text-secondary)" }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", width: "2.5rem" }}>
            {brushSize}px
          </span>
          <input
            type="range"
            min="5"
            max="100"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className={styles.sliderInput}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={undo}
            disabled={undoStack.length <= 1}
            className={`${btnStyles.btn} ${btnStyles.btnSecondary}`}
            style={undoStack.length <= 1 ? { opacity: 0.3, cursor: "not-allowed" } : {}}
            title="元に戻す (Undo)"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={clearMask}
            className={`${btnStyles.btn} ${btnStyles.btnSecondary}`}
            style={{ borderColor: "rgba(244, 63, 94, 0.2)", color: "var(--color-rose)" }}
            title="マスクをクリア"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className={styles.canvasArea}>
        {!imageSrc && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "var(--text-muted)", padding: "2rem" }}>
            <Paintbrush size={32} style={{ marginBottom: "0.5rem", opacity: 0.2 }} />
            <p style={{ fontSize: "0.8rem" }}>画像をアップロードしてください</p>
          </div>
        )}

        {imageSrc && (
          <>
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Source"
              onLoad={handleImageLoaded}
              style={{ width: "100%", height: "auto", maxHeight: "70vh", display: "block", pointerEvents: "none" }}
            />
            <canvas
              ref={maskCanvasRef}
              onMouseDown={startDrawing}
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseUp={stopDrawing}
              onMouseLeave={handleMouseLeave}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                cursor: "none",
                zIndex: 10,
                pointerEvents: "auto",
                opacity: 0.45,
                touchAction: "none",
              }}
            />
            {cursorPos && canvasRect && canvasWidth > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: cursorPos.x,
                  top: cursorPos.y,
                  width: `${brushSize * (canvasRect.width / canvasWidth)}px`,
                  height: `${brushSize * (canvasRect.width / canvasWidth)}px`,
                  border: "1.5px dashed rgba(255, 255, 255, 0.9)",
                  boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.6)",
                  borderRadius: "50%",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  zIndex: 20,
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
