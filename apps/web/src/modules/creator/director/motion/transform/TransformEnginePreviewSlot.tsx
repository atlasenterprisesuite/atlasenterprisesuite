import { TransformSpritePreview } from './TransformSpritePreview';

/** Preview-only; the caller must provide a verified same-origin PNG. */
export function TransformEnginePreviewSlot({ imagePath }: { imagePath: string }) {
  return <aside aria-label="Transform Engine preview">
    <h3>Transform Engine preview</h3>
    <TransformSpritePreview src={imagePath} />
  </aside>;
}
