using System.Collections.Generic;
using UnityEngine;

namespace Atlas.ArDrive
{
    [RequireComponent(typeof(LineRenderer))]
    public sealed class AtlasMiniMapRouteRenderer : MonoBehaviour
    {
        [SerializeField] private Transform vehicleMarker;
        [SerializeField] private float metersToWorld = 0.02f;
        [SerializeField] private float routeHeight = 0.02f;

        private LineRenderer line;
        private GeoPoint origin;
        private bool hasOrigin;

        private void Awake()
        {
            line = GetComponent<LineRenderer>();
            line.useWorldSpace = false;
            line.alignment = LineAlignment.TransformZ;
        }

        public void RenderRoute(IReadOnlyList<GeoPoint> route)
        {
            if (route == null || route.Count < 2)
            {
                line.positionCount = 0;
                hasOrigin = false;
                return;
            }

            origin = route[0];
            hasOrigin = true;
            line.positionCount = route.Count;
            for (int i = 0; i < route.Count; i++)
            {
                Vector2 local = GeoMath.ToLocalMeters(origin, route[i]) * metersToWorld;
                line.SetPosition(i, new Vector3(local.x, routeHeight, local.y));
            }
        }

        public void UpdateVehicle(GeoPoint position, float bearingDeg)
        {
            if (!hasOrigin || vehicleMarker == null) return;
            Vector2 local = GeoMath.ToLocalMeters(origin, position) * metersToWorld;
            vehicleMarker.localPosition = new Vector3(local.x, routeHeight + 0.02f, local.y);
            vehicleMarker.localRotation = Quaternion.Euler(90f, bearingDeg, 0f);
        }
    }
}
