export type ImageEditVisibility = 'private' | 'organization';

export type ImageEditPoint = {
  id: string;
  x: number;
  y: number;
  instruction: string;
};

export type ImageEditRequest = {
  globalInstruction: string;
  preserveIdentity: boolean;
  aspectRatio: 'adaptive' | '1:1' | '9:16' | '16:9';
  visibility: ImageEditVisibility;
  points: ImageEditPoint[];
};

export type ImageEditValidation =
  | { ok: true }
  | { ok: false; error: 'image_edit_instruction_required' | 'image_edit_point_invalid' | 'image_edit_visibility_invalid' | 'image_edit_aspect_ratio_invalid' };

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function normalizeImageEditPoint(x: number, y: number, width: number, height: number) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
  return {
    x: clamp01(x / safeWidth),
    y: clamp01(y / safeHeight)
  };
}

export function validateImageEditRequest(request: ImageEditRequest): ImageEditValidation {
  const hasGlobalInstruction = request.globalInstruction.trim().length > 0;
  const hasPointInstruction = request.points.some(point => point.instruction.trim().length > 0);
  if (!hasGlobalInstruction && !hasPointInstruction) {
    return { ok: false, error: 'image_edit_instruction_required' };
  }

  for (const point of request.points) {
    if (!point.id.trim() || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      return { ok: false, error: 'image_edit_point_invalid' };
    }
  }

  if (request.visibility !== 'private' && request.visibility !== 'organization') {
    return { ok: false, error: 'image_edit_visibility_invalid' };
  }

  if (!['adaptive', '1:1', '9:16', '16:9'].includes(request.aspectRatio)) {
    return { ok: false, error: 'image_edit_aspect_ratio_invalid' };
  }

  return { ok: true };
}
