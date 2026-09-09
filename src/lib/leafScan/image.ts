// Capture and preprocessing for the leaf scanner. No new browser permission
// flow: <input type="file" capture="environment"> gives a camera on mobile
// and a file picker on desktop with zero JS-side permission prompt, unlike
// getUserMedia(). Nothing here uploads anything — it produces the exact
// float tensor public/models/leaf-v1/model.onnx expects, entirely in-memory.
//
// The canvas re-encode in `preprocessLeafImage` is also the privacy boundary:
// drawing a bitmap to a fresh canvas and reading pixels back strips EXIF,
// including any GPS geotag the phone attached to the original photo. Combined
// with on-device inference (nothing in this module performs a network
// request), a farmer's photo and its location never leave the device on the
// default scan path -- see planned_features.md sec.1's DPDP Act 2023 flag on
// farm data. Do not "optimize" this into a direct decode that skips the
// canvas step; the EXIF strip is a deliberate side effect, not an accident.

/** Matches preprocessor_config.json on the source HF model: shortest-edge
 *  resize to 256, then a 224 center crop. */
const RESIZE_SHORTEST_EDGE = 256;
const CROP_SIZE = 224;

/** rescale_factor 1/255 folded into normalize: pixel/255 -> (x - 0.5) / 0.5. */
const MEAN = 0.5;
const STD = 0.5;

export interface PreprocessedImage {
  /** NCHW float32, [1, 3, 224, 224], normalized to roughly [-1, 1]. */
  tensor: Float32Array;
  /** The exact 224x224 crop that was fed to the model, for the CAM overlay to draw on. */
  displayCanvas: HTMLCanvasElement;
}

/**
 * Decode a File/Blob, resize (shortest edge 256), center-crop to 224x224, and
 * return both the model input tensor and the cropped image for display.
 *
 * `imageOrientation: 'from-image'` makes createImageBitmap apply the EXIF
 * orientation tag before we ever touch pixels, so a phone photo taken in
 * portrait doesn't come out sideways.
 */
export async function preprocessLeafImage(file: File | Blob): Promise<PreprocessedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    const { width, height } = bitmap;
    const scale = RESIZE_SHORTEST_EDGE / Math.min(width, height);
    const resizedW = Math.round(width * scale);
    const resizedH = Math.round(height * scale);

    const resizeCanvas = document.createElement('canvas');
    resizeCanvas.width = resizedW;
    resizeCanvas.height = resizedH;
    const rctx = resizeCanvas.getContext('2d');
    if (!rctx) throw new Error('Canvas 2D context unavailable');
    rctx.imageSmoothingEnabled = true;
    rctx.imageSmoothingQuality = 'high';
    rctx.drawImage(bitmap, 0, 0, resizedW, resizedH);

    const cropX = Math.floor((resizedW - CROP_SIZE) / 2);
    const cropY = Math.floor((resizedH - CROP_SIZE) / 2);

    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = CROP_SIZE;
    displayCanvas.height = CROP_SIZE;
    const dctx = displayCanvas.getContext('2d');
    if (!dctx) throw new Error('Canvas 2D context unavailable');
    dctx.drawImage(
      resizeCanvas,
      cropX,
      cropY,
      CROP_SIZE,
      CROP_SIZE,
      0,
      0,
      CROP_SIZE,
      CROP_SIZE,
    );

    const { data } = dctx.getImageData(0, 0, CROP_SIZE, CROP_SIZE); // RGBA, HWC

    // HWC RGBA -> CHW RGB, normalized. Three separate channel passes rather
    // than one interleaved loop, since NCHW needs each channel contiguous.
    const tensor = new Float32Array(3 * CROP_SIZE * CROP_SIZE);
    const plane = CROP_SIZE * CROP_SIZE;
    for (let y = 0; y < CROP_SIZE; y++) {
      for (let x = 0; x < CROP_SIZE; x++) {
        const pixelIdx = (y * CROP_SIZE + x) * 4;
        const outIdx = y * CROP_SIZE + x;
        tensor[outIdx] = (data[pixelIdx] / 255 - MEAN) / STD; // R
        tensor[plane + outIdx] = (data[pixelIdx + 1] / 255 - MEAN) / STD; // G
        tensor[2 * plane + outIdx] = (data[pixelIdx + 2] / 255 - MEAN) / STD; // B
      }
    }

    return { tensor, displayCanvas };
  } finally {
    bitmap.close();
  }
}
