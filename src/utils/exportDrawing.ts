import {
  Skia,
  ImageFormat,
  PaintStyle,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';
import { DrawingData, Point, SelectionRect, Stroke } from '../types/models';

export type ExportSize = { width: number; height: number };

export const EXPORT_SIZE_PORTRAIT: ExportSize = { width: 2048, height: 2732 };
export const EXPORT_SIZE_LANDSCAPE: ExportSize = { width: 2732, height: 2048 };

const BACKGROUND_COLOR = '#ffffff';

function buildPath(points: Point[]) {
  const path = Skia.Path.Make();
  if (points.length === 0) {
    return path;
  }
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    path.lineTo(points[i].x, points[i].y);
  }
  return path;
}

function drawStroke(stroke: Stroke) {
  const path = buildPath(stroke.points);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeJoin(StrokeJoin.Round);
  paint.setStrokeWidth(stroke.width);
  paint.setColor(Skia.Color(stroke.color));
  return { path, paint };
}

export function getExportSizeForLogicalSize(
  logicalSize: ExportSize,
): ExportSize {
  if (logicalSize.width > logicalSize.height) {
    return EXPORT_SIZE_LANDSCAPE;
  }
  return EXPORT_SIZE_PORTRAIT;
}

export function renderDrawingToPngBase64(
  drawingData: DrawingData,
  logicalSize: ExportSize,
  outputSize: ExportSize,
): string {
  if (logicalSize.width <= 0 || logicalSize.height <= 0) {
    throw new Error('Invalid logical canvas size for export.');
  }

  const surface = Skia.Surface.Make(outputSize.width, outputSize.height);
  if (!surface) {
    throw new Error('Failed to create Skia surface for export.');
  }

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color(BACKGROUND_COLOR));

  const scaleX = outputSize.width / logicalSize.width;
  const scaleY = outputSize.height / logicalSize.height;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (outputSize.width - logicalSize.width * scale) / 2;
  const offsetY = (outputSize.height - logicalSize.height * scale) / 2;

  canvas.save();
  canvas.translate(offsetX, offsetY);
  canvas.scale(scale, scale);

  drawingData.strokes.forEach(stroke => {
    if (stroke.points.length === 0) {
      return;
    }
    const { path, paint } = drawStroke(stroke);
    canvas.drawPath(path, paint);
  });

  canvas.restore();

  const image = surface.makeImageSnapshot();
  // SkImage.encodeToBase64 is available in @shopify/react-native-skia 2.4.x.
  const base64 = image.encodeToBase64(ImageFormat.PNG, 100);
  if (!base64) {
    throw new Error('Failed to encode PNG image.');
  }
  return base64;
}

const MAX_REGION_OUTPUT_DIM = 2048;

export function renderRegionToPngBase64(
  drawingData: DrawingData,
  logicalSize: ExportSize,
  selection: SelectionRect,
): string {
  if (selection.width <= 0 || selection.height <= 0) {
    throw new Error('Invalid selection rectangle.');
  }

  // Calculate output dimensions preserving aspect ratio, capped at MAX_REGION_OUTPUT_DIM
  const aspectRatio = selection.width / selection.height;
  let outputWidth: number;
  let outputHeight: number;

  if (aspectRatio >= 1) {
    // Landscape or square: cap width
    outputWidth = Math.min(MAX_REGION_OUTPUT_DIM, Math.round(selection.width * 4));
    outputHeight = Math.round(outputWidth / aspectRatio);
  } else {
    // Portrait: cap height
    outputHeight = Math.min(MAX_REGION_OUTPUT_DIM, Math.round(selection.height * 4));
    outputWidth = Math.round(outputHeight * aspectRatio);
  }

  // Ensure minimum size
  outputWidth = Math.max(outputWidth, 100);
  outputHeight = Math.max(outputHeight, 100);

  const surface = Skia.Surface.Make(outputWidth, outputHeight);
  if (!surface) {
    throw new Error('Failed to create Skia surface for region export.');
  }

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color(BACKGROUND_COLOR));

  // Calculate scale to map selection region to output
  const scale = Math.min(outputWidth / selection.width, outputHeight / selection.height);

  // Center the content in output
  const offsetX = (outputWidth - selection.width * scale) / 2;
  const offsetY = (outputHeight - selection.height * scale) / 2;

  canvas.save();
  canvas.translate(offsetX, offsetY);
  canvas.scale(scale, scale);
  // Translate to make selection.x, selection.y the origin
  canvas.translate(-selection.x, -selection.y);

  // Draw all strokes
  drawingData.strokes.forEach(stroke => {
    if (stroke.points.length === 0) {
      return;
    }
    const { path, paint } = drawStroke(stroke);
    canvas.drawPath(path, paint);
  });

  canvas.restore();

  const image = surface.makeImageSnapshot();
  const base64 = image.encodeToBase64(ImageFormat.PNG, 100);
  if (!base64) {
    throw new Error('Failed to encode PNG image for region.');
  }
  return base64;
}
