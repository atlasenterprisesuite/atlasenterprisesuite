using UnityEngine;

namespace Atlas.ArDrive
{
    public sealed class AtlasSplitScreenLayout : MonoBehaviour
    {
        [SerializeField] private Camera arCamera;
        [SerializeField] private Camera mapCamera;
        [SerializeField, Range(0.30f, 0.70f)] private float arFraction = 0.50f;

        private void Awake() => Apply();

        public void Apply()
        {
            if (arCamera != null)
                arCamera.rect = new Rect(0f, 1f - arFraction, 1f, arFraction);
            if (mapCamera != null)
                mapCamera.rect = new Rect(0f, 0f, 1f, 1f - arFraction);
        }
    }
}
