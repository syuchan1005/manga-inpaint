import { useState, useRef, useEffect } from "react";
import * as ort from "onnxruntime-web/webgpu";
import type { HistoryItem } from "./types";

import { MaskCanvas } from "./components/MaskCanvas";
import { ModelSelector } from "./components/ModelSelector";
import { ShowImageDiff } from "./components/ShowImageDiff";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Dropzone } from "./components/Dropzone";
import { SystemMonitor } from "./components/SystemMonitor";
import { ActionBar } from "./components/ActionBar";
import { DebugPanel } from "./components/DebugPanel";
import { ToastAlert } from "./components/ToastAlert";
import { HistorySection } from "./components/HistorySection";
import { HistoryModal } from "./components/HistoryModal";

import {
  getPaddingInfo,
  drawToTargetSize,
  prepareInputTensors,
  blendOutput,
  findMaskGroups,
} from "./lib/imageProcessing";
import {
  createSession,
  warmupSession,
  runInpaintInference,
  bufferPool,
} from "./lib/inference";
import type { DownloadProgress } from "./lib/inference";

import styles from "./App.module.css";

export default function App() {
  // Image states
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [resultImageSrc, setResultImageSrc] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [maskDataUrl, setMaskDataUrl] = useState<string | undefined>(undefined);

  // Model & session states
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [activeBackend, setActiveBackend] = useState<"webgpu" | "wasm" | null>(null);
  const [lastInferenceTime, setLastInferenceTime] = useState<number | null>(null);
  const activeSessionRef = useRef<ort.InferenceSession | null>(null);
  const [targetSize, setTargetSize] = useState<number>(384);
  const [precision, setPrecision] = useState<"fp16" | "fp32">("fp16");
  const [inferenceMode, setInferenceMode] = useState<"single" | "patch">("single");

  const handlePrecisionChange = (newPrecision: "fp16" | "fp32") => {
    if (newPrecision === precision) return;
    setPrecision(newPrecision);
    setIsModelLoaded(false);
    activeSessionRef.current = null;
    setLastInferenceTime(null);
  };

  const handleToggleComparison = () => {
    if (!showComparison && maskCanvasRef.current) {
      setMaskDataUrl(maskCanvasRef.current.toDataURL());
    }
    setShowComparison((prev) => !prev);
  };
  
  // Monitoring states
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [gpuInfo, setGpuInfo] = useState<string | null>(null);
  const [isWebGPUSupported, setIsWebGPUSupported] = useState<boolean>(false);

  // Canvas drawing states
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [brushSize, setBrushSize] = useState(25);
  const [isEraser, setIsEraser] = useState(false);

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  // Debug states
  const [debugMaskUrls, setDebugMaskUrls] = useState<string[]>([]);
  const [debugInputImageUrls, setDebugInputImageUrls] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);

  // History states
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryItem, setActiveHistoryItem] = useState<HistoryItem | null>(null);

  // Query GPU hardware info and manage cleanup
  useEffect(() => {
    const checkWebGPU = async () => {
      if ("gpu" in navigator) {
        setIsWebGPUSupported(true);
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            let desc = "";
            if (adapter.info) {
              desc = adapter.info.description || adapter.info.device || "";
            } else if ('requestAdapterInfo' in adapter) {
              // @ts-expect-error - requestAdapterInfo might not be standard on all TS typings yet
              const adapterInfo = await adapter.requestAdapterInfo();
              desc = adapterInfo.description || adapterInfo.device || "";
            }
            setGpuInfo(desc || "GPUデバイスが検出されました");
          } else {
            setGpuInfo("GPUにアクセスできません");
          }
        } catch (e) {
          console.error("GPUの取得に失敗しました:", e);
          setGpuInfo("GPU初期化エラー");
        }
      } else {
        setIsWebGPUSupported(false);
        setGpuInfo("WebGPU非サポート (WASMフォールバック)");
      }
    };
    checkWebGPU();

    return () => {
      activeSessionRef.current = null;
    };
  }, []);

  const handleReplaceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadFromFile(file);
    }
  };

  const loadFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageSrc(event.target.result as string);
        setResultImageSrc(null);
        setShowComparison(false);
        setMaskDataUrl(undefined);
        setLastInferenceTime(null);
        setDebugMaskUrls([]);
        setDebugInputImageUrls([]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageLoad = (img: HTMLImageElement) => {
    setOriginalImage(img);
  };

  // Generate a programmatic anime/manga style illustration as a sample
  const generateMangaSample = () => {
    const img = new Image();
    img.src = "/manga_sample.png"; // public folder is served at root
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. Draw the loaded manga image
      ctx.drawImage(img, 0, 0);

      // 2. Add Censor Bar (the target to inpaint)
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      
      const censorX = Math.round(w * 0.20);
      const censorY = Math.round(h * 0.53);
      const censorW = Math.round(w * 0.20);
      const censorH = Math.round(h * 0.07);

      ctx.fillStyle = "#000000";
      ctx.fillRect(censorX, censorY, censorW, censorH);
      
      ctx.fillStyle = "#ffffff";
      const fontSize = Math.max(12, Math.round(h * 0.018));
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("[ CENSOR ]", censorX + censorW / 2, censorY + censorH / 2);

      setImageSrc(canvas.toDataURL("image/png"));
      setResultImageSrc(null);
      setShowComparison(false);
      setMaskDataUrl(undefined);
      setLastInferenceTime(null);
      setDebugMaskUrls([]);
      setDebugInputImageUrls([]);
    };
    img.onerror = (e) => {
      console.error("Failed to load manga sample image:", e);
      alert("サンプル画像 (public/manga_sample.png) の読み込みに失敗しました。");
    };
  };

  const handleInpaint = async () => {
    if (!imageSrc || !originalImage || !maskCanvasRef.current) return;
    
    // Calculate active target size (dynamic original size or selected preset size)
    const activeSize = targetSize === 0
      ? Math.ceil(Math.max(originalImage.naturalWidth, originalImage.naturalHeight) / 8) * 8
      : targetSize;
      
    setIsProcessing(true);
    setProgressMsg("セッションを準備中...");
    setDebugMaskUrls([]);
    setDebugInputImageUrls([]);

    try {
      // 1. Prepare session
      let session = activeSessionRef.current;
      if (!session || !isModelLoaded) {
        setIsModelLoading(true);
        setDownloadProgress(null);
        const res = await createSession(
          precision,
          (msg) => setProgressMsg(msg),
          (progress) => setDownloadProgress(progress)
        );
        session = res.session;
        setActiveBackend(res.backend);
        setIsModelLoaded(true);
        activeSessionRef.current = session;
        setDownloadProgress(null);

        // Warm up at the actual target size to ensure shader cache hits during inference
        setProgressMsg(`ONNX Runtime WebGPU ウォームアップ中 (${activeSize}x${activeSize})...`);
        await warmupSession(session, activeSize);
      }

      // 2. Branch on inference mode
      let resultDataUrl = "";
      let totalInferenceTimeMs = 0;

      if (inferenceMode === "single") {
        // --- 全体一括推論 ---
        setProgressMsg(`画像をリサイズ・パディング中 (${activeSize}x${activeSize})...`);
        const info = getPaddingInfo(originalImage.naturalWidth, originalImage.naturalHeight, activeSize);
        const paddedImgCanvas = drawToTargetSize(originalImage, info);
        const paddedMaskCanvas = drawToTargetSize(maskCanvasRef.current, info);

        const reuseBuffers = {
          imageArray: bufferPool.getImageBuffer(activeSize),
          maskArray: bufferPool.getMaskBuffer(activeSize),
        };
        const { imageArray, maskArray } = prepareInputTensors(paddedImgCanvas, paddedMaskCanvas, activeSize, reuseBuffers);

        // Generate debug URLs for visual verification
        try {
          const debugMaskCanvas = document.createElement("canvas");
          debugMaskCanvas.width = activeSize;
          debugMaskCanvas.height = activeSize;
          const dmCtx = debugMaskCanvas.getContext("2d");
          if (dmCtx) {
            const dmImgData = dmCtx.createImageData(activeSize, activeSize);
            for (let i = 0; i < activeSize * activeSize; i++) {
              const val = maskArray[i] > 0.5 ? 255 : 0;
              dmImgData.data[i * 4] = val;     // R
              dmImgData.data[i * 4 + 1] = val; // G
              dmImgData.data[i * 4 + 2] = val; // B
              dmImgData.data[i * 4 + 3] = 255; // A
            }
            dmCtx.putImageData(dmImgData, 0, 0);
            setDebugMaskUrls([debugMaskCanvas.toDataURL()]);
          }

          const debugInputCanvas = document.createElement("canvas");
          debugInputCanvas.width = activeSize;
          debugInputCanvas.height = activeSize;
          const diCtx = debugInputCanvas.getContext("2d");
          if (diCtx) {
            const diImgData = diCtx.createImageData(activeSize, activeSize);
            const numPixels = activeSize * activeSize;
            for (let i = 0; i < numPixels; i++) {
              diImgData.data[i * 4] = Math.round(imageArray[i] * 255);                 // R
              diImgData.data[i * 4 + 1] = Math.round(imageArray[numPixels + i] * 255);     // G
              diImgData.data[i * 4 + 2] = Math.round(imageArray[2 * numPixels + i] * 255); // B
              diImgData.data[i * 4 + 3] = 255;                                         // A
            }
            diCtx.putImageData(diImgData, 0, 0);
            setDebugInputImageUrls([debugInputCanvas.toDataURL()]);
          }
        } catch (debugErr) {
          console.warn("Failed to generate debug preview:", debugErr);
        }

        setProgressMsg("AIインペイント推論を実行中...");
        const { outputData, inferenceTimeMs } = await runInpaintInference(session, imageArray, maskArray, activeSize);
        totalInferenceTimeMs = inferenceTimeMs;

        setProgressMsg("出力画像をブレンド・再構築中...");
        const blendedCanvas = blendOutput(outputData, originalImage, maskCanvasRef.current, info);
        resultDataUrl = blendedCanvas.toDataURL();

      } else {
        // --- 分割グループ推論 ---
        setProgressMsg("マスク領域を検出中...");
        const groups = findMaskGroups(maskCanvasRef.current, 3, 0.25);
        if (groups.length === 0) {
          throw new Error("有効なマスクが検出されませんでした。マスクをキャンバスに描画してください。");
        }

        // Initialize master result canvas starting with the original image
        const masterCanvas = document.createElement("canvas");
        masterCanvas.width = originalImage.naturalWidth;
        masterCanvas.height = originalImage.naturalHeight;
        const masterCtx = masterCanvas.getContext("2d");
        if (!masterCtx) throw new Error("Could not get master canvas 2D context");
        masterCtx.drawImage(originalImage, 0, 0);

        const newMaskUrls: string[] = [];
        const newInputImageUrls: string[] = [];

        for (let idx = 0; idx < groups.length; idx++) {
          const group = groups[idx];
          setProgressMsg(`分割グループ推論を実行中 (${idx + 1} / ${groups.length})...`);

          const wBox = group.x2 - group.x1;
          const hBox = group.y2 - group.y1;
          const cx = (group.x1 + group.x2) / 2;
          const cy = (group.y1 + group.y2) / 2;

          // Determine centered crop box of size at least activeSize clamped to image boundaries
          let cropW = Math.max(wBox, activeSize);
          let cropH = Math.max(hBox, activeSize);

          cropW = Math.min(cropW, originalImage.naturalWidth);
          cropH = Math.min(cropH, originalImage.naturalHeight);

          let cropX = Math.round(cx - cropW / 2);
          let cropY = Math.round(cy - cropH / 2);

          if (cropX < 0) cropX = 0;
          if (cropY < 0) cropY = 0;
          if (cropX + cropW > originalImage.naturalWidth) cropX = originalImage.naturalWidth - cropW;
          if (cropY + cropH > originalImage.naturalHeight) cropY = originalImage.naturalHeight - cropH;

          // Extract sub-image from current master canvas (contains previous inpaints if overlapping)
          const subImage = document.createElement("canvas");
          subImage.width = cropW;
          subImage.height = cropH;
          const subImgCtx = subImage.getContext("2d");
          if (!subImgCtx) throw new Error("Could not get subImage context");
          subImgCtx.drawImage(masterCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

          // Extract sub-mask from maskCanvasRef.current
          const subMask = document.createElement("canvas");
          subMask.width = cropW;
          subMask.height = cropH;
          const subMaskCtx = subMask.getContext("2d");
          if (!subMaskCtx) throw new Error("Could not get subMask context");
          subMaskCtx.drawImage(maskCanvasRef.current, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

          // Get padding/scaling info to fit the subImage into activeSize x activeSize
          const info = getPaddingInfo(cropW, cropH, activeSize);
          const paddedImgCanvas = drawToTargetSize(subImage, info);
          const paddedMaskCanvas = drawToTargetSize(subMask, info);

          const reuseBuffers = {
            imageArray: bufferPool.getImageBuffer(activeSize),
            maskArray: bufferPool.getMaskBuffer(activeSize),
          };
          const { imageArray, maskArray } = prepareInputTensors(paddedImgCanvas, paddedMaskCanvas, activeSize, reuseBuffers);

          // Update debug URLs for the current patch
          try {
            const debugMaskCanvas = document.createElement("canvas");
            debugMaskCanvas.width = activeSize;
            debugMaskCanvas.height = activeSize;
            const dmCtx = debugMaskCanvas.getContext("2d");
            if (dmCtx) {
              const dmImgData = dmCtx.createImageData(activeSize, activeSize);
              for (let i = 0; i < activeSize * activeSize; i++) {
                const val = maskArray[i] > 0.5 ? 255 : 0;
                dmImgData.data[i * 4] = val;     // R
                dmImgData.data[i * 4 + 1] = val; // G
                dmImgData.data[i * 4 + 2] = val; // B
                dmImgData.data[i * 4 + 3] = 255; // A
              }
              dmCtx.putImageData(dmImgData, 0, 0);
              newMaskUrls.push(debugMaskCanvas.toDataURL());
            }

            const debugInputCanvas = document.createElement("canvas");
            debugInputCanvas.width = activeSize;
            debugInputCanvas.height = activeSize;
            const diCtx = debugInputCanvas.getContext("2d");
            if (diCtx) {
              const diImgData = diCtx.createImageData(activeSize, activeSize);
              const numPixels = activeSize * activeSize;
              for (let i = 0; i < numPixels; i++) {
                diImgData.data[i * 4] = Math.round(imageArray[i] * 255);                 // R
                diImgData.data[i * 4 + 1] = Math.round(imageArray[numPixels + i] * 255);     // G
                diImgData.data[i * 4 + 2] = Math.round(imageArray[2 * numPixels + i] * 255); // B
                diImgData.data[i * 4 + 3] = 255;                                         // A
              }
              diCtx.putImageData(diImgData, 0, 0);
              newInputImageUrls.push(debugInputCanvas.toDataURL());
            }
          } catch (debugErr) {
            console.warn("Failed to generate debug preview:", debugErr);
          }

          // Run inference
          const { outputData, inferenceTimeMs } = await runInpaintInference(session, imageArray, maskArray, activeSize);
          totalInferenceTimeMs += inferenceTimeMs;

          // Blend patch back using subImage & subMask
          const blendedPatchCanvas = blendOutput(outputData, subImage, subMask, info);

          // Draw the blended patch back onto the master canvas
          masterCtx.drawImage(blendedPatchCanvas, cropX, cropY);
        }

        setDebugMaskUrls(newMaskUrls);
        setDebugInputImageUrls(newInputImageUrls);
        resultDataUrl = masterCanvas.toDataURL();
      }

      setLastInferenceTime(totalInferenceTimeMs);
      setResultImageSrc(resultDataUrl);
      setMaskDataUrl(maskCanvasRef.current?.toDataURL() || undefined);
      setShowComparison(true);
      setProgressMsg("処理が完了しました！");

      // 履歴に追加
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        originalSrc: imageSrc,
        resultSrc: resultDataUrl,
        maskSrc: maskCanvasRef.current?.toDataURL() || undefined,
        timestamp: Date.now(),
        precision,
        targetSize,
        inferenceMode,
        inferenceTimeMs: totalInferenceTimeMs,
      };
      setHistory((prev) => [newHistoryItem, ...prev]);
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setProgressMsg(`エラーが発生しました: ${errMsg}`);
    } finally {
      setIsProcessing(false);
      setIsModelLoading(false);
    }
  };

  const downloadResult = () => {
    if (!resultImageSrc) return;
    const a = document.createElement("a");
    a.href = resultImageSrc;
    a.download = "inpainted_manga.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    setImageSrc(null);
    setResultImageSrc(null);
    setShowComparison(false);
    setMaskDataUrl(undefined);
    setOriginalImage(null);
    setDebugMaskUrls([]);
    setDebugInputImageUrls([]);
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className={styles.mangaApp}>
      {/* Background radial highlights */}
      <div className={styles.mangaGlowTop} />
      <div className={styles.mangaGlowBottom} />

      {/* Header */}
      <Header />

      {/* Main Panel */}
      <main className={styles.mangaMain}>
        {!imageSrc ? (
          /* Landing upload state */
          <Dropzone
            onFileSelect={loadFromFile}
            onSampleSelect={generateMangaSample}
          />
        ) : (
          /* Active dashboard */
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}>
            {/* Model Selector Card */}
            <div className={styles.mangaCard}>
              <ModelSelector
                isLoaded={isModelLoaded}
                isLoading={isModelLoading}
                activeBackend={activeBackend}
                lastInferenceTime={lastInferenceTime}
                targetSize={targetSize}
                setTargetSize={setTargetSize}
                precision={precision}
                onPrecisionChange={handlePrecisionChange}
                originalWidth={originalImage?.naturalWidth}
                originalHeight={originalImage?.naturalHeight}
                inferenceMode={inferenceMode}
                setInferenceMode={setInferenceMode}
              />
              
              {/* System Monitor Section */}
              <SystemMonitor
                isWebGPUSupported={isWebGPUSupported}
                gpuInfo={gpuInfo}
                downloadProgress={downloadProgress}
                showDebugPanel={showDebugPanel}
                setShowDebugPanel={setShowDebugPanel}
              />
            </div>

            {/* Action Bar */}
            <ActionBar
              onReset={handleReset}
              onReplaceImage={handleReplaceImage}
              hasResult={!!resultImageSrc}
              showComparison={showComparison}
              onToggleComparison={handleToggleComparison}
              onInpaint={handleInpaint}
              isProcessing={isProcessing}
              onDownload={downloadResult}
            />

            {/* Canvas / View Mode */}
            <div style={{ display: "flex", justifyContent: "center", width: "100%", position: "relative" }}>
              {showComparison && resultImageSrc && (
                <ShowImageDiff
                  before={imageSrc}
                  after={resultImageSrc}
                  maskSrc={maskDataUrl}
                />
              )}
              <div style={{ display: (!showComparison || !resultImageSrc) ? "block" : "none", width: "100%" }}>
                <MaskCanvas
                  imageSrc={imageSrc}
                  onImageLoad={handleImageLoad}
                  maskCanvasRef={maskCanvasRef}
                  brushSize={brushSize}
                  setBrushSize={setBrushSize}
                  isEraser={isEraser}
                  setIsEraser={setIsEraser}
                />
              </div>
            </div>

            {/* Debug Panel Section */}
            <DebugPanel
              showDebugPanel={showDebugPanel}
              targetSize={targetSize}
              debugMaskUrls={debugMaskUrls}
              debugInputImageUrls={debugInputImageUrls}
            />

            {/* Toast Alerts (Fixed bottom right) */}
            <ToastAlert
              isProcessing={isProcessing}
              progressMsg={progressMsg}
              downloadProgress={downloadProgress}
              onClearMsg={() => setProgressMsg("")}
            />

            {/* History Section */}
            <HistorySection
              history={history}
              onDelete={handleDeleteHistoryItem}
              onSelectCompare={setActiveHistoryItem}
            />
          </div>
        )}
      </main>

      {/* Footer Info */}
      <Footer />

      {/* History Slide Comparison Modal */}
      <HistoryModal
        activeHistoryItem={activeHistoryItem}
        onClose={() => setActiveHistoryItem(null)}
      />
    </div>
  );
}
