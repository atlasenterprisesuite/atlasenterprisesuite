import { useRef, useState } from 'react';
import { validateComplianceImageMetadata } from '../../../../../packages/compliance/file-policy';

export type ProfilePhotoCaptureProps = {
  disabled?: boolean;
  onValidFile: (file: File) => void;
};

export async function validateBrowserImage(file: File) {
  const metadata = validateComplianceImageMetadata({ mimeType: file.type, sizeBytes: file.size });
  if (!metadata.ok) throw new Error(metadata.error);

  const objectUrl = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('image_decode_failed'));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  return file;
}

function validationMessage(code: string) {
  if (code === 'unsupported_image_type') return 'Choose a JPEG, PNG, or WebP image.';
  if (code === 'image_too_large') return 'The image must be 10 MiB or smaller.';
  if (code === 'empty_image') return 'The selected image is empty.';
  return 'The selected file could not be decoded as an image.';
}

export function ProfilePhotoCapture({ disabled = false, onValidFile }: ProfilePhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [validating, setValidating] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const [error, setError] = useState('');

  async function select(file: File | null) {
    setError('');
    setSelectedName('');
    if (!file) return;
    setValidating(true);
    try {
      await validateBrowserImage(file);
      setSelectedName(file.name);
      onValidFile(file);
    } catch (cause) {
      setError(validationMessage(cause instanceof Error ? cause.message : 'image_decode_failed'));
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="ride-photo-capture">
      <label className="field" htmlFor="ride-profile-photo-input">
        <span>Profile photo</span>
        <input
          ref={inputRef}
          id="ride-profile-photo-input"
          className="ride-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          aria-describedby="profile-photo-help"
          disabled={disabled || validating}
          onChange={(event) => void select(event.currentTarget.files?.[0] || null)}
        />
      </label>
      <p id="profile-photo-help" className="ride-help">Use a clear current photo. ATLAS validates file format and browser decoding only; it does not perform facial recognition.</p>
      <button
        className="action-button ride-photo-trigger"
        type="button"
        disabled={disabled || validating}
        aria-busy={validating ? 'true' : undefined}
        onClick={() => inputRef.current?.click()}
      >
        {validating ? 'Checking image…' : 'Take or choose photo'}
      </button>
      {selectedName ? <p className="ride-selected-file">Selected: {selectedName}</p> : null}
      {error ? <div className="hospitality-message error" role="alert">{error}</div> : null}
    </div>
  );
}
