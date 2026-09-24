using UnityEngine;

namespace Atlas.ArDrive
{
    public sealed class AtlasArDriveController : MonoBehaviour
    {
        [SerializeField] private AtlasRouteClient routeClient;
        [SerializeField] private AtlasGeospatialRouteRenderer geospatialRenderer;
        [SerializeField] private AtlasLocalRouteRenderer localRenderer;

        public string LastState { get; private set; } = "idle";

        public void SetSession(string endpoint, string organizationId, string accessToken)
        {
            if (routeClient == null)
            {
                LastState = "route_client_missing";
                return;
            }
            routeClient.Configure(endpoint, organizationId, accessToken);
            LastState = routeClient.IsConfigured ? "session_ready" : "session_incomplete";
        }

        public void StartRoute(GeoPoint origin, GeoPoint destination)
        {
            if (routeClient == null)
            {
                LastState = "route_client_missing";
                return;
            }

            LastState = "loading_route";
            StartCoroutine(routeClient.GetRoute(origin, destination, (points, route) =>
            {
                bool rendered = false;
                if (geospatialRenderer != null && geospatialRenderer.GeospatialReady)
                    rendered = geospatialRenderer.RenderRoute(points);

                if (!rendered && localRenderer != null)
                    rendered = localRenderer.RenderRoute(origin, points);

                LastState = rendered ? "route_rendered" : "route_render_failed";
            }, error => LastState = error));
        }
    }
}
