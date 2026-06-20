import * as ort from 'onnxruntime-web/webgpu';

// Configure ONNX Runtime Web WASM paths
ort.env.wasm.wasmPaths = import.meta.env.BASE_URL;

// Inference result interfaces
export interface InferenceResult {
  outputData: Float32Array;
  inferenceTimeMs: number;
}

export interface DownloadProgress {
  progress: number;
  loaded: number;
  total: number;
}

/**
 * Pre-allocated buffer pool for reusing Float32Arrays across inferences.
 * Avoids repeated allocation and GC pressure during batch/sequential processing.
 */
class TensorBufferPool {
  private imageBuffers = new Map<number, Float32Array>();
  private maskBuffers = new Map<number, Float32Array>();
  private outputBuffers = new Map<number, Float32Array>();

  getImageBuffer(targetSize: number): Float32Array {
    const key = targetSize;
    let buf = this.imageBuffers.get(key);
    if (!buf || buf.length !== 3 * targetSize * targetSize) {
      buf = new Float32Array(3 * targetSize * targetSize);
      this.imageBuffers.set(key, buf);
    }
    return buf;
  }

  getMaskBuffer(targetSize: number): Float32Array {
    const key = targetSize;
    let buf = this.maskBuffers.get(key);
    if (!buf || buf.length !== targetSize * targetSize) {
      buf = new Float32Array(targetSize * targetSize);
      this.maskBuffers.set(key, buf);
    }
    return buf;
  }

  getOutputBuffer(targetSize: number): Float32Array {
    const key = targetSize;
    let buf = this.outputBuffers.get(key);
    if (!buf || buf.length !== 3 * targetSize * targetSize) {
      buf = new Float32Array(3 * targetSize * targetSize);
      this.outputBuffers.set(key, buf);
    }
    return buf;
  }

  clear(): void {
    this.imageBuffers.clear();
    this.maskBuffers.clear();
    this.outputBuffers.clear();
  }
}

/** Singleton buffer pool instance */
export const bufferPool = new TensorBufferPool();

/**
 * Creates an InferenceSession with performance-optimized settings.
 * Prefers WebGPU, falls back to WASM. Downloads the model file with progress tracking.
 */
export async function createSession(
  precision: 'fp16' | 'fp32' = 'fp16',
  onProgress?: (msg: string) => void,
  onDownloadProgress?: (progress: DownloadProgress) => void
): Promise<{ session: ort.InferenceSession; backend: 'webgpu' | 'wasm' }> {
  const modelUrl = precision === 'fp16'
    ? `${import.meta.env.BASE_URL}models/lama-manga-onnx-dynamic-fp16.onnx?v=hybrid_v3`
    : `${import.meta.env.BASE_URL}models/lama-manga-onnx-dynamic.onnx`;
  onProgress?.(`モデルファイルをダウンロード中...`);

  // Fetch model with progress
  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`モデルの取得に失敗しました: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  const contentLength = +(response.headers.get('Content-Length') || 0);

  if (!reader) {
    throw new Error("レスポンスボディを読み込めません。");
  }

  const chunks: Uint8Array[] = [];
  let receivedLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    if (contentLength > 0) {
      const progress = (receivedLength / contentLength) * 100;
      onDownloadProgress?.({ progress, loaded: receivedLength, total: contentLength });
    }
  }

  onProgress?.("モデルデータをメモリに読み込み中...");

  const modelBuffer = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    modelBuffer.set(chunk, position);
    position += chunk.length;
  }

  // Optimized session options
  const baseSessionOptions: ort.InferenceSession.SessionOptions = {
    graphOptimizationLevel: 'all',       // Enable all graph optimizations (node fusion, constant folding)
  };

  // WebGPU support check
  const hasWebGPU = 'gpu' in navigator;
  
  if (hasWebGPU) {
    try {
      onProgress?.('WebGPUセッションを初期化中 (グラフ最適化有効)...');
      const session = await ort.InferenceSession.create(modelBuffer, {
        ...baseSessionOptions,
        executionProviders: ['webgpu'],
      });
      onProgress?.('モデルがWebGPUバックエンドで正常にロードされました。(最適化済み)');
      return { session, backend: 'webgpu' };
    } catch (err) {
      console.warn('WebGPU creation failed, trying WASM fallback:', err);
      onProgress?.('WebGPU初期化失敗。WASMバックエンドにフォールバックします...');
    }
  } else {
    onProgress?.('ブラウザがWebGPUを非サポートです。WASMを使用します...');
  }

  // Fallback to WASM
  try {
    const session = await ort.InferenceSession.create(modelBuffer, {
      ...baseSessionOptions,
      executionProviders: ['wasm'],
    });
    onProgress?.('モデルがWASMバックエンドで正常にロードされました。');
    return { session, backend: 'wasm' };
  } catch (err) {
    console.error('WASM creation failed:', err);
    onProgress?.('どのバックエンドでもモデルをロードできませんでした。');
    throw err;
  }
}

/**
 * Run a dummy inference step to pre-compile WebGPU shaders
 * and warm up the inference session.
 * Uses buffer pool to avoid unnecessary allocations.
 */
export async function warmupSession(
  session: ort.InferenceSession,
  targetSize: number = 512
): Promise<void> {
  const dummyImgData = bufferPool.getImageBuffer(targetSize);
  const dummyMaskData = bufferPool.getMaskBuffer(targetSize);
  
  // Zero-fill for clean warmup
  dummyImgData.fill(0);
  dummyMaskData.fill(0);
  
  const imageTensor = new ort.Tensor('float32', dummyImgData, [1, 3, targetSize, targetSize]);
  const maskTensor = new ort.Tensor('float32', dummyMaskData, [1, 1, targetSize, targetSize]);

  try {
    const feeds = {
      image: imageTensor,
      mask: maskTensor,
    };
    
    const results = await session.run(feeds);
    
    // Clean up results immediately
    for (const key of Object.keys(results)) {
      results[key].dispose();
    }
  } finally {
    imageTensor.dispose();
    maskTensor.dispose();
  }
}

/**
 * Runs inpainting inference on the input image and mask Float32Arrays.
 * Returns the output Float32Array and inference duration.
 * 
 * Optimization: reuses output buffer from pool to avoid allocation.
 * The returned outputData is a COPY into the pool buffer, valid until next call at the same targetSize.
 * If you need to keep the data, clone it before the next inference call.
 */
export async function runInpaintInference(
  session: ort.InferenceSession,
  imageFloat32Array: Float32Array,
  maskFloat32Array: Float32Array,
  targetSize: number = 512
): Promise<InferenceResult> {
  const outputName = session.outputNames[0];

  const imageTensor = new ort.Tensor('float32', imageFloat32Array, [1, 3, targetSize, targetSize]);
  const maskTensor = new ort.Tensor('float32', maskFloat32Array, [1, 1, targetSize, targetSize]);

  const feeds = {
    image: imageTensor,
    mask: maskTensor,
  };

  const startTime = performance.now();
  try {
    const results = await session.run(feeds);
    const endTime = performance.now();
    const inferenceTimeMs = endTime - startTime;

    const outputTensor = results[outputName];
    if (!outputTensor) {
      throw new Error(`Output tensor "${outputName}" not found in model results.`);
    }

    // Copy output data into pooled buffer to avoid repeated allocation
    const srcData = outputTensor.data as Float32Array;
    const outputData = bufferPool.getOutputBuffer(targetSize);
    outputData.set(srcData);

    // Clean up all output tensors
    for (const key of Object.keys(results)) {
      results[key].dispose();
    }

    return {
      outputData,
      inferenceTimeMs,
    };
  } finally {
    imageTensor.dispose();
    maskTensor.dispose();
  }
}
