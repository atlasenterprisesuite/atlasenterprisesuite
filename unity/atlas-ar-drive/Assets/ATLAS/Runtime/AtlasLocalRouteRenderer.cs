using System.Collections.Generic;
using UnityEngine;

namespace Atlas.ArDrive
{
    public sealed class AtlasLocalRouteRenderer : MonoBehaviour
    {
        [SerializeField] private Transform localOrigin;
        [SerializeField] private GameObject arrowPrefab;
        [SerializeField] private float arrowSpacingM = 8f;
        [SerializeField] private float maxAheadM = 140f;
        private readonly List<GameObject> arrows = new();

        public void ClearRoute()
        {
            foreach (var arrow in arrows)
                if (arrow != null) Destroy(arrow);
            arrows.Clear();
        }

        public bool RenderRoute(GeoPoint origin, IReadOnlyList<GeoPoint> route)
        {
            ClearRoute();
            if (localOrigin == null || arrowPrefab == null || route == null || route.Count < 2) return false;

            var sampled = RouteResampler.EveryMeters(route, arrowSpacingM, maxAheadM);
            for (int i = 0; i < sampled.Count; i++)
            {
                var point = sampled[i];
                var next = sampled[Mathf.Min(i + 1, sampled.Count - 1)];
                Vector2 local = GeoMath.ToLocalMeters(origin, point);
                float bearing = GeoMath.BearingDegrees(point, next);
                var arrow = Instantiate(arrowPrefab, localOrigin);
                arrow.transform.localPosition = new Vector3(local.x, 0.08f, local.y);
                arrow.transform.localRotation = Quaternion.Euler(90f, bearing, 0f);
                arrows.Add(arrow);
            }
            return arrows.Count > 0;
        }

        private void OnDisable() => ClearRoute();
    }
}
