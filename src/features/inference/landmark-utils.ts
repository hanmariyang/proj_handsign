import {
  type InferenceResultPayload,
  type InteractionState,
  type LandmarkPoint,
} from "@/features/inference/inference-types";
import { HAND_CONNECTIONS } from "@/shared/constants";

export function calculatePinchDistance(
  thumbTip?: LandmarkPoint,
  indexTip?: LandmarkPoint,
) {
  if (!thumbTip || !indexTip) {
    return Number.POSITIVE_INFINITY;
  }

  const dx = thumbTip.x - indexTip.x;
  const dy = thumbTip.y - indexTip.y;

  return Math.hypot(dx, dy);
}

export function averageLandmarks(
  landmarks: LandmarkPoint[],
  indices: number[],
): LandmarkPoint | null {
  const selected = indices
    .map((index) => landmarks[index])
    .filter(Boolean) as LandmarkPoint[];

  if (selected.length === 0) {
    return null;
  }

  const total = selected.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
      z: sum.z + point.z,
    }),
    { x: 0, y: 0, z: 0 },
  );

  return {
    x: total.x / selected.length,
    y: total.y / selected.length,
    z: total.z / selected.length,
  };
}

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
  const pixelRatio = window.devicePixelRatio || 1;
  const nextWidth = Math.floor(canvas.clientWidth * pixelRatio);
  const nextHeight = Math.floor(canvas.clientHeight * pixelRatio);

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
}

function toCanvasPoint(canvas: HTMLCanvasElement, point: LandmarkPoint) {
  return {
    x: (1 - point.x) * canvas.width,
    y: point.y * canvas.height,
  };
}

export function clearOverlay(canvas: HTMLCanvasElement | null) {
  if (!canvas) {
    return;
  }

  resizeCanvasToDisplaySize(canvas);

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawHandOverlay(
  canvas: HTMLCanvasElement | null,
  result: InferenceResultPayload | null,
  interactionState: InteractionState,
) {
  if (!canvas) {
    return;
  }

  resizeCanvasToDisplaySize(canvas);

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  const hand = result?.landmarks[0];
  if (!hand?.length) {
    return;
  }

  const pixelRatio = window.devicePixelRatio || 1;

  context.save();
  context.lineWidth = 2 * pixelRatio;
  context.strokeStyle = "rgba(129, 248, 216, 0.62)";
  context.fillStyle = "rgba(255, 188, 83, 0.95)";

  for (const [start, end] of HAND_CONNECTIONS) {
    const startPoint = hand[start];
    const endPoint = hand[end];

    if (!startPoint || !endPoint) {
      continue;
    }

    const from = toCanvasPoint(canvas, startPoint);
    const to = toCanvasPoint(canvas, endPoint);

    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  for (const point of hand) {
    const canvasPoint = toCanvasPoint(canvas, point);
    context.beginPath();
    context.arc(canvasPoint.x, canvasPoint.y, 5 * pixelRatio, 0, Math.PI * 2);
    context.fill();
  }

  if (interactionState.pointer) {
    const pointer = toCanvasPoint(canvas, interactionState.pointer);

    context.beginPath();
    context.lineWidth = 3 * pixelRatio;
    context.strokeStyle = "rgba(255, 255, 255, 0.92)";
    context.arc(
      pointer.x,
      pointer.y,
      (18 + interactionState.pinch * 18) * pixelRatio,
      0,
      Math.PI * 2,
    );
    context.stroke();
  }

  if (interactionState.palmCenter) {
    const labelPoint = toCanvasPoint(canvas, interactionState.palmCenter);
    const label = interactionState.gestureLabel ?? "Tracking";

    context.fillStyle = "rgba(7, 12, 21, 0.82)";
    context.fillRect(labelPoint.x - 70, labelPoint.y - 54, 140, 34);
    context.fillStyle = "#f7f5ef";
    context.font = `${14 * pixelRatio}px "Space Grotesk"`;
    context.textAlign = "center";
    context.fillText(label, labelPoint.x, labelPoint.y - 31);
  }

  context.restore();
}
