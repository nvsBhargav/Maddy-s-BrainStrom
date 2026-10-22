// Client-side image intake: always store a compressed copy, never the raw upload.
// The canvas is the only resize step, so no dependencies and no server needed.

export const MAX_IMAGE_BYTES = 100 * 1024;
const MAX_EDGE = 1600;
const MIN_QUALITY = 0.32;

function loadBitmap(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).catch(() => loadViaImage(file));
  }
  return loadViaImage(file);
}

function loadViaImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not a readable image."));
    };
    img.src = url;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the compressed image."));
    reader.readAsDataURL(blob);
  });
}

function draw(source, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Compress an upload to a JPEG no larger than `maxBytes` (default 100 KB).
 * Returns { dataUrl, width, height, bytes, name }.
 */
export async function compressImage(file, { maxBytes = MAX_IMAGE_BYTES } = {}) {
  const source = await loadBitmap(file);
  const srcW = source.width || source.naturalWidth;
  const srcH = source.height || source.naturalHeight;
  if (!srcW || !srcH) throw new Error("Empty image file.");

  const ratio = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  let width = Math.max(1, Math.round(srcW * ratio));
  let height = Math.max(1, Math.round(srcH * ratio));
  let quality = 0.9;
  let blob = null;

  for (let attempt = 0; attempt < 14; attempt++) {
    const canvas = draw(source, width, height);
    blob = await toBlob(canvas, quality);
    if (blob && blob.size <= maxBytes) break;
    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.1);
    } else {
      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
    }
  }

  if (!blob) throw new Error("The browser could not encode this image.");
  if (blob.size > maxBytes) throw new Error("Could not compress below 100 KB — try a smaller image.");

  const dataUrl = await blobToDataUrl(blob);
  return {
    id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: file.name || "image.jpg",
    dataUrl,
    width,
    height,
    bytes: blob.size,
  };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
