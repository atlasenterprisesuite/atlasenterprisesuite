using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Atlas.ArDrive
{
    [Serializable]
    public sealed class AtlasWaypointDto
    {
        public double lat;
        public double lon;
    }

    [Serializable]
    public sealed class AtlasRouteDto
    {
        public string id;
        public float distance_m;
        public float duration_s;
        public AtlasWaypointDto[] waypoints;
    }

    [Serializable]
    public sealed class AtlasRouteResponse
    {
        public bool ok;
        public string source;
        public AtlasRouteDto[] routes;
        public string error;
    }

    [Serializable]
    internal sealed class AtlasRouteRequest
    {
        public string operation = "route";
        public string organization_id;
        public double from_lat;
        public double from_lon;
        public double to_lat;
        public double to_lon;
    }

    public sealed class AtlasRouteClient : MonoBehaviour
    {
        [SerializeField] private string atlasGpsEndpoint = "";
        [SerializeField] private string organizationId = "";
        [NonSerialized] private string accessToken = "";

        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(atlasGpsEndpoint)
            && !string.IsNullOrWhiteSpace(organizationId)
            && !string.IsNullOrWhiteSpace(accessToken);

        public void Configure(string endpoint, string orgId, string token)
        {
            atlasGpsEndpoint = endpoint?.Trim() ?? "";
            organizationId = orgId?.Trim() ?? "";
            accessToken = token?.Trim() ?? "";
        }

        public void ClearSession()
        {
            accessToken = "";
            organizationId = "";
        }

        public IEnumerator GetRoute(
            GeoPoint origin,
            GeoPoint destination,
            Action<IReadOnlyList<GeoPoint>, AtlasRouteDto> onSuccess,
            Action<string> onError)
        {
            if (!IsConfigured)
            {
                onError?.Invoke("atlas_route_client_not_configured");
                yield break;
            }

            var requestBody = new AtlasRouteRequest
            {
                organization_id = organizationId,
                from_lat = origin.lat,
                from_lon = origin.lon,
                to_lat = destination.lat,
                to_lon = destination.lon
            };

            string json = JsonUtility.ToJson(requestBody);
            using var request = new UnityWebRequest(atlasGpsEndpoint, UnityWebRequest.kHttpVerbPOST);
            request.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("Authorization", "Bearer " + accessToken);
            request.SetRequestHeader("x-atlas-org-id", organizationId);
            request.timeout = 15;

            yield return request.SendWebRequest();

            if (request.result != UnityWebRequest.Result.Success)
            {
                onError?.Invoke("atlas_route_http_" + request.responseCode);
                yield break;
            }

            AtlasRouteResponse response;
            try
            {
                response = JsonUtility.FromJson<AtlasRouteResponse>(request.downloadHandler.text);
            }
            catch
            {
                onError?.Invoke("atlas_route_invalid_json");
                yield break;
            }

            if (response == null || !response.ok || response.routes == null || response.routes.Length == 0)
            {
                onError?.Invoke(response?.error ?? "atlas_route_missing");
                yield break;
            }

            AtlasRouteDto route = response.routes[0];
            if (route.waypoints == null || route.waypoints.Length < 2)
            {
                onError?.Invoke("atlas_route_waypoints_missing");
                yield break;
            }

            var points = new List<GeoPoint>(route.waypoints.Length);
            foreach (var point in route.waypoints)
                points.Add(new GeoPoint(point.lat, point.lon));

            onSuccess?.Invoke(points, route);
        }
    }
}
