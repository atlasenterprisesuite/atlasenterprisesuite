using System.Collections.Generic;
using Google.XR.ARCoreExtensions;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

namespace Atlas.ArDrive
{
    public sealed class AtlasGeospatialRouteRenderer : MonoBehaviour
    {
        [Header("ARCore Extensions")]
        [SerializeField] private AREarthManager earthManager;
        [SerializeField] private ARAnchorManager anchorManager;

        [Header("Route Visual")]
        [SerializeField] private GameObject arrowPrefab;
        [SerializeField, Range(3f, 20f)] private float arrowSpacingM = 8f;
        [SerializeField, Range(40f, 250f)] private float maxAheadM = 140f;
        [SerializeField] private float arrowHeightOffsetM = 0.08f;

        private readonly List<ARGeospatialAnchor> anchors = new();
        private readonly List<GameObject> arrows = new();

        public bool GeospatialReady =>
            earthManager != null
            && earthManager.EarthTrackingState == TrackingState.Tracking;

        public void ClearRoute()
        {
            foreach (var arrow in arrows)
                if (arrow != null) Destroy(arrow);
            arrows.Clear();

            foreach (var anchor in anchors)
                if (anchor != null) Destroy(anchor.gameObject);
            anchors.Clear();
        }

        public bool RenderRoute(IReadOnlyList<GeoPoint> route)
        {
            ClearRoute();
            if (!GeospatialReady || anchorManager == null || arrowPrefab == null || route == null || route.Count < 2)
                return false;

            var sampled = RouteResampler.EveryMeters(route, arrowSpacingM, maxAheadM);
            for (int i = 0; i < sampled.Count; i++)
            {
                GeoPoint point = sampled[i];
                GeoPoint next = sampled[Mathf.Min(i + 1, sampled.Count - 1)];
                float bearing = GeoMath.BearingDegrees(point, next);

                double altitude = earthManager.CameraGeospatialPose.Altitude + arrowHeightOffsetM;
                ARGeospatialAnchor anchor = ARAnchorManagerExtensions.AddAnchor(
                    anchorManager,
                    point.lat,
                    point.lon,
                    altitude,
                    Quaternion.identity
                );

                if (anchor == null) continue;

                var arrow = Instantiate(arrowPrefab, anchor.transform);
                arrow.transform.localPosition = Vector3.zero;
                arrow.transform.localRotation = Quaternion.Euler(90f, bearing, 0f);
                anchors.Add(anchor);
                arrows.Add(arrow);
            }

            return arrows.Count > 0;
        }

        private void OnDisable() => ClearRoute();
    }
}
