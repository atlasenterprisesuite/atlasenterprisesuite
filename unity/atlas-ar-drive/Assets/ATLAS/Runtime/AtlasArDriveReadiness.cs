using Google.XR.ARCoreExtensions;
using UnityEngine;
using UnityEngine.XR.ARSubsystems;

namespace Atlas.ArDrive
{
    public enum AtlasArReadinessState
    {
        ConsentRequired,
        Initializing,
        Unsupported,
        LocationDenied,
        WaitingForLocation,
        WaitingForEarth,
        Tracking
    }

    public sealed class AtlasArDriveReadiness : MonoBehaviour
    {
        private const string ConsentKey = "atlas.ar_drive.geospatial_consent.v1";

        [SerializeField] private AREarthManager earthManager;
        [SerializeField] private ARCoreExtensions arCoreExtensions;
        [SerializeField] private bool showRuntimePanel = true;

        public AtlasArReadinessState State { get; private set; } = AtlasArReadinessState.Initializing;
        public bool HasConsent => PlayerPrefs.GetInt(ConsentKey, 0) == 1;
        public FeatureSupported GeospatialSupport { get; private set; } = FeatureSupported.Unknown;

        private void Awake()
        {
            if (!HasConsent)
            {
                State = AtlasArReadinessState.ConsentRequired;
                if (arCoreExtensions != null) arCoreExtensions.enabled = false;
            }
        }

        private void Start()
        {
            if (HasConsent) StartGeospatial();
        }

        public void GrantConsent()
        {
            PlayerPrefs.SetInt(ConsentKey, 1);
            PlayerPrefs.Save();
            StartGeospatial();
        }

        public void RevokeConsent()
        {
            PlayerPrefs.DeleteKey(ConsentKey);
            PlayerPrefs.Save();
            if (Input.location.status == LocationServiceStatus.Running) Input.location.Stop();
            if (arCoreExtensions != null) arCoreExtensions.enabled = false;
            State = AtlasArReadinessState.ConsentRequired;
        }

        private void StartGeospatial()
        {
            GeospatialSupport = AREarthManager.IsGeospatialModeSupported(GeospatialMode.Enabled);
            if (GeospatialSupport == FeatureSupported.Unsupported)
            {
                State = AtlasArReadinessState.Unsupported;
                return;
            }

            if (arCoreExtensions != null) arCoreExtensions.enabled = true;
            if (Input.location.status == LocationServiceStatus.Stopped)
                Input.location.Start(0.5f, 0.5f);

            State = AtlasArReadinessState.WaitingForLocation;
        }

        private void Update()
        {
            if (!HasConsent)
            {
                State = AtlasArReadinessState.ConsentRequired;
                return;
            }

            GeospatialSupport = AREarthManager.IsGeospatialModeSupported(GeospatialMode.Enabled);
            if (GeospatialSupport == FeatureSupported.Unsupported)
            {
                State = AtlasArReadinessState.Unsupported;
                return;
            }

            if (Input.location.status == LocationServiceStatus.Failed)
            {
                State = AtlasArReadinessState.LocationDenied;
                return;
            }

            if (Input.location.status != LocationServiceStatus.Running)
            {
                State = AtlasArReadinessState.WaitingForLocation;
                return;
            }

            if (earthManager == null || earthManager.EarthTrackingState != TrackingState.Tracking)
            {
                State = AtlasArReadinessState.WaitingForEarth;
                return;
            }

            State = AtlasArReadinessState.Tracking;
        }

        private void OnGUI()
        {
            if (!showRuntimePanel) return;

            var rect = new Rect(16, 16, Mathf.Min(520, Screen.width - 32), HasConsent ? 88 : 190);
            GUI.Box(rect, "");
            GUILayout.BeginArea(new Rect(rect.x + 12, rect.y + 10, rect.width - 24, rect.height - 20));
            GUILayout.Label("ATLAS AR Drive");
            GUILayout.Label("Estado: " + State);

            if (!HasConsent)
            {
                GUILayout.Space(8);
                GUILayout.Label("AR Drive usa cámara, ubicación precisa y sensores para alinear la ruta con el mundo real. ARCore Geospatial puede procesar esos datos cuando está habilitado.");
                GUILayout.Space(8);
                if (GUILayout.Button("Permitir AR y ubicación precisa"))
                    GrantConsent();
            }

            GUILayout.EndArea();
        }
    }
}
