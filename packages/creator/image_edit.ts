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
  | { ok: false; error: 'image_edit_request_invalid' | 'image_edit_instruction_required' | 'image_edit_point_invalid' | 'image_edit_visibility_invalid' | 'image_edit_aspect_ratio_invalid' };

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

export function validateImageEditRequest(request: unknown): ImageEditValidation {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return { ok: false, error: 'image_edit_request_invalid' };
  }

  const value = request as Record<string, unknown>;
  if (
    typeof value.globalInstruction !== 'string' ||
    typeof value.preserveIdentity !== 'boolean' ||
    typeof value.aspectRatio !== 'string' ||
    typeof value.visibility !== 'string' ||
    !Array.isArray(value.points)
  ) {
    return { ok: false, error: 'image_edit_request_invalid' };
  }

  const points: ImageEditPoint[] = [];
  for (const candidate of value.points) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return { ok: false, error: 'image_edit_point_invalid' };
    }
    const point = candidate as Record<string, unknown>;
    if (
      typeof point.id !== 'string' ||
      typeof point.x !== 'number' ||
      typeof point.y !== 'number' ||
      typeof point.instruction !== 'string'
    ) {
      return { ok: false, error: 'image_edit_point_invalid' };
    }
    points.push({
      id: point.id,
      x: point.x,
      y: point.y,
      instruction: point.instruction
    });
  }

  const hasGlobalInstruction = value.globalInstruction.trim().length > 0;
  const hasPointInstruction = points.some(point => point.instruction.trim().length > 0);
  if (!hasGlobalInstruction && !hasPointInstruction) {
    return { ok: false, error: 'image_edit_instruction_required' };
  }

  for (const point of points) {
    if (!point.id.trim() || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
      return { ok: false, error: 'image_edit_point_invalid' };
    }
  }

  if (value.visibility !== 'private' && value.visibility !== 'organization') {
    return { ok: false, error: 'image_edit_visibility_invalid' };
  }

  if (!['adaptive', '1:1', '9:16', '16:9'].includes(value.aspectRatio)) {
    return { ok: false, error: 'image_edit_aspect_ratio_invalid' };
  }

  return { ok: true };
}
