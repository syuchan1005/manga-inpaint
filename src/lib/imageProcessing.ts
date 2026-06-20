export interface ImagePaddingInfo {
  originalWidth: number;
  originalHeight: number;
  scale: number;
  dx: number;
  dy: number;
  targetWidth: number;
  targetHeight: number;
}

/**
 * Calculates padding and scaling information to fit an image into a target square size
 * while maintaining the aspect ratio (centered letterboxing).
 */
export function getPaddingInfo(
  originalWidth: number,
  originalHeight: number,
  targetSize: number = 512
): ImagePaddingInfo {
  const scale = Math.min(targetSize / originalWidth, targetSize / originalHeight);
  const newW = originalWidth * scale;
  const newH = originalHeight * scale;
  const dx = Math.floor((targetSize - newW) / 2);
  const dy = Math.floor((targetSize - newH) / 2);

  return {
    originalWidth,
    originalHeight,
    scale,
    dx,
    dy,
    targetWidth: targetSize,
    targetHeight: targetSize,
  };
}

/**
 * Draws an image/canvas onto a target size canvas with letterboxing.
 */
export function drawToTargetSize(
  source: HTMLImageElement | HTMLCanvasElement,
  info: ImagePaddingInfo
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = info.targetWidth;
  canvas.height = info.targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");

  // Fill background with black/transparent (transparent is fine, but for safety in model we can use black)
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, info.targetWidth, info.targetHeight);

  // Draw scaled image
  ctx.drawImage(
    source,
    0,
    0,
    info.originalWidth,
    info.originalHeight,
    info.dx,
    info.dy,
    info.originalWidth * info.scale,
    info.originalHeight * info.scale
  );

  return canvas;
}

export interface ModelInputs {
  imageArray: Float32Array;
  maskArray: Float32Array;
}

/**
 * Extracts the image and mask inputs from the pre-processed canvases.
 * - imageArray: CHW [1, 3, 512, 512] float32 representing the masked image (image * (1 - mask))
 * - maskArray: CHW [1, 1, 512, 512] float32 representing the binary mask (1.0 = mask, 0.0 = background)
 *
 * Optimization: Pass pre-allocated buffers via `reuseBuffers` to avoid repeated allocation.
 */
export function prepareInputTensors(
  imageCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  targetSize: number = 512,
  reuseBuffers?: { imageArray: Float32Array; maskArray: Float32Array }
): ModelInputs {
  const imgCtx = imageCanvas.getContext("2d");
  const maskCtx = maskCanvas.getContext("2d");

  if (!imgCtx || !maskCtx) {
    throw new Error("Could not get 2D context for preparation");
  }

  const imgData = imgCtx.getImageData(0, 0, targetSize, targetSize);
  const maskData = maskCtx.getImageData(0, 0, targetSize, targetSize);

  const numPixels = targetSize * targetSize;
  const imageArray = reuseBuffers?.imageArray ?? new Float32Array(3 * numPixels);
  const maskArray = reuseBuffers?.maskArray ?? new Float32Array(1 * numPixels);

  for (let i = 0; i < numPixels; i++) {
    const r = imgData.data[i * 4] / 255.0;
    const g = imgData.data[i * 4 + 1] / 255.0;
    const b = imgData.data[i * 4 + 2] / 255.0;

    // Mask value: active if the mask color (drawn as red) is solid/visible
    const mVal = maskData.data[i * 4] > 128 ? 1.0 : 0.0;

    // Image input: masked image (RGB * (1 - mask))
    imageArray[i] = r * (1.0 - mVal);                 // R channel
    imageArray[numPixels + i] = g * (1.0 - mVal);     // G channel
    imageArray[2 * numPixels + i] = b * (1.0 - mVal); // B channel

    // Mask input: binary mask (1.0 in mask, 0.0 elsewhere)
    maskArray[i] = mVal;
  }

  return { imageArray, maskArray };
}

/**
 * Reconstructs the final image by taking the model output [1, 3, 512, 512],
 * scaling it back, and blending it with the original image only inside the mask area.
 */
export function blendOutput(
  modelOutput: Float32Array,
  originalImage: HTMLImageElement | HTMLCanvasElement,
  originalMask: HTMLCanvasElement, // Mask at original scale
  info: ImagePaddingInfo
): HTMLCanvasElement {
  const targetSize = info.targetWidth;
  const cSize = targetSize * targetSize;

  // 1. Create a canvas for the model output at 512x512
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = targetSize;
  outputCanvas.height = targetSize;
  const outCtx = outputCanvas.getContext("2d");
  if (!outCtx) throw new Error("Could not get output 2D context");

  const outImgData = outCtx.createImageData(targetSize, targetSize);

  for (let i = 0; i < cSize; i++) {
    // Model output is channels 0, 1, 2 (RGB) in range [0, 1] (or slightly out of bound, clamp it)
    const r = Math.max(0, Math.min(255, Math.round(modelOutput[i] * 255)));
    const g = Math.max(0, Math.min(255, Math.round(modelOutput[cSize + i] * 255)));
    const b = Math.max(0, Math.min(255, Math.round(modelOutput[2 * cSize + i] * 255)));

    outImgData.data[i * 4] = r;
    outImgData.data[i * 4 + 1] = g;
    outImgData.data[i * 4 + 2] = b;
    outImgData.data[i * 4 + 3] = 255; // Alpha
  }
  outCtx.putImageData(outImgData, 0, 0);

  // 2. Crop the output canvas back to the scaled image dimensions
  const croppedCanvas = document.createElement("canvas");
  const scaledWidth = Math.round(info.originalWidth * info.scale);
  const scaledHeight = Math.round(info.originalHeight * info.scale);
  croppedCanvas.width = scaledWidth;
  croppedCanvas.height = scaledHeight;
  const cropCtx = croppedCanvas.getContext("2d");
  if (!cropCtx) throw new Error("Could not get crop 2D context");

  cropCtx.drawImage(
    outputCanvas,
    info.dx,
    info.dy,
    scaledWidth,
    scaledHeight,
    0,
    0,
    scaledWidth,
    scaledHeight
  );

  // 3. Create the final result canvas at original image dimensions
  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = info.originalWidth;
  resultCanvas.height = info.originalHeight;
  const resCtx = resultCanvas.getContext("2d");
  if (!resCtx) throw new Error("Could not get result 2D context");

  // Draw the original image first
  resCtx.drawImage(originalImage, 0, 0);

  // Draw the model's output resized back to original dimensions
  // To avoid blending artifacts, we can draw the inpainted result on a temporary canvas,
  // then mask it with the original mask, and draw it on top of the original image.
  const tempInpaintCanvas = document.createElement("canvas");
  tempInpaintCanvas.width = info.originalWidth;
  tempInpaintCanvas.height = info.originalHeight;
  const tempCtx = tempInpaintCanvas.getContext("2d");
  if (!tempCtx) throw new Error("Could not get temp 2D context");

  tempCtx.drawImage(
    croppedCanvas,
    0,
    0,
    scaledWidth,
    scaledHeight,
    0,
    0,
    info.originalWidth,
    info.originalHeight
  );

  // Apply the original mask to the tempInpaintCanvas so we only keep inpainted pixels.
  // We can do this by setting composite operation to 'destination-in' with the mask canvas.
  // The mask canvas has white pixels where inpainting should occur, and black/transparent elsewhere.
  // Wait, to do destination-in, we need the mask to have alpha=255 in the inpaint region and alpha=0 elsewhere.
  // Let's create an alpha mask from the original mask canvas.
  const alphaMaskCanvas = document.createElement("canvas");
  alphaMaskCanvas.width = info.originalWidth;
  alphaMaskCanvas.height = info.originalHeight;
  const alphaMaskCtx = alphaMaskCanvas.getContext("2d");
  if (!alphaMaskCtx) throw new Error("Could not get alpha mask context");

  // Copy mask canvas pixels
  alphaMaskCtx.drawImage(originalMask, 0, 0);
  const maskPixels = alphaMaskCtx.getImageData(0, 0, info.originalWidth, info.originalHeight);
  // Set alpha based on red channel (if red > 128, alpha = 255, else alpha = 0)
  for (let i = 0; i < maskPixels.data.length; i += 4) {
    const r = maskPixels.data[i];
    const g = maskPixels.data[i + 1]
    const b = maskPixels.data[i + 2];
    const isMasked = (r > 128 || g > 128 || b > 128);
    maskPixels.data[i + 3] = isMasked ? 255 : 0; // Alpha channel
  }
  alphaMaskCtx.putImageData(maskPixels, 0, 0);

  // Apply the alpha mask to the temp inpainted canvas
  tempCtx.globalCompositeOperation = "destination-in";
  tempCtx.drawImage(alphaMaskCanvas, 0, 0);

  // Now draw the masked inpainted pixels back onto the result canvas
  resCtx.globalCompositeOperation = "source-over";
  resCtx.drawImage(tempInpaintCanvas, 0, 0);

  return resultCanvas;
}

export interface MaskGroup {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  activePixels: number;
}

/**
 * Scans the mask canvas, identifies disconnected masked regions (islands),
 * and groups them together using a simple distance threshold.
 * Step-scanning makes it extremely fast (O(1ms)).
 */
export function findMaskGroups(
  maskCanvas: HTMLCanvasElement,
  maxGroups: number = 3,
  mergeThreshold: number = 0.25 // Merge if within 25% of max image dimension
): MaskGroup[] {
  const ctx = maskCanvas.getContext("2d");
  if (!ctx) return [];
  const w = maskCanvas.width;
  const h = maskCanvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const pixels = imgData.data;
  
  // 1. Identify all active points (red channel threshold)
  // Step scan for fast execution
  const step = 4;
  const points: {x: number; y: number}[] = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      // Mask color is drawn as red, check if red channel is active
      if (pixels[idx] > 128) {
        points.push({ x, y });
      }
    }
  }
  
  if (points.length === 0) return [];
  
  // 2. Simple distance-based clustering
  const maxDistance = Math.max(w, h) * mergeThreshold;
  const groups: { points: {x: number; y: number}[] }[] = [];
  
  for (const p of points) {
    let merged = false;
    for (const g of groups) {
      // Check distance to points in this group
      let minD = Infinity;
      for (const gp of g.points) {
        const dx = p.x - gp.x;
        const dy = p.y - gp.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minD) minD = d;
      }
      
      if (minD < maxDistance) {
        g.points.push(p);
        merged = true;
        break;
      }
    }
    
    if (!merged) {
      groups.push({ points: [p] });
    }
  }
  
  // 3. Convert groups to bounding boxes
  const maskGroups: MaskGroup[] = groups.map(g => {
    let x1 = w, y1 = h, x2 = 0, y2 = 0;
    for (const p of g.points) {
      if (p.x < x1) x1 = p.x;
      if (p.y < y1) y1 = p.y;
      if (p.x > x2) x2 = p.x;
      if (p.y > y2) y2 = p.y;
    }
    
    // Add safety margin padding around bounding box
    const padding = 15;
    x1 = Math.max(0, x1 - padding);
    y1 = Math.max(0, y1 - padding);
    x2 = Math.min(w, x2 + padding);
    y2 = Math.min(h, y2 + padding);
    
    return { x1, y1, x2, y2, activePixels: g.points.length };
  });
  
  // 4. Sort by size and limit groups
  maskGroups.sort((a, b) => b.activePixels - a.activePixels);
  return maskGroups.slice(0, maxGroups);
}
