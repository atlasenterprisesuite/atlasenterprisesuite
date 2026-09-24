using System;
using UnityEngine;

namespace Atlas.ArDrive
{
    [Serializable]
    public struct GeoPoint
    {
        public double lat;
        public double lon;
        public double alt;

        public GeoPoint(double latitude, double longitude, double altitude = 0)
        {
            lat = latitude;
            lon = longitude;
            alt = altitude;
        }
    }

    public static class GeoMath
    {
        private const double EarthRadiusM = 6371000.0;

        public static Vector2 ToLocalMeters(GeoPoint origin, GeoPoint target)
        {
            double lat1 = origin.lat * Math.PI / 180.0;
            double lat2 = target.lat * Math.PI / 180.0;
            double dLat = (target.lat - origin.lat) * Math.PI / 180.0;
            double dLon = (target.lon - origin.lon) * Math.PI / 180.0;

            double x = dLon * Math.Cos((lat1 + lat2) * 0.5) * EarthRadiusM;
            double z = dLat * EarthRadiusM;
            return new Vector2((float)x, (float)z);
        }

        public static double DistanceMeters(GeoPoint a, GeoPoint b)
        {
            double lat1 = a.lat * Math.PI / 180.0;
            double lat2 = b.lat * Math.PI / 180.0;
            double dLat = lat2 - lat1;
            double dLon = (b.lon - a.lon) * Math.PI / 180.0;
            double h = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(lat1) * Math.Cos(lat2) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            return 2 * EarthRadiusM * Math.Asin(Math.Sqrt(h));
        }

        public static float BearingDegrees(GeoPoint a, GeoPoint b)
        {
            double lat1 = a.lat * Math.PI / 180.0;
            double lat2 = b.lat * Math.PI / 180.0;
            double dLon = (b.lon - a.lon) * Math.PI / 180.0;
            double y = Math.Sin(dLon) * Math.Cos(lat2);
            double x = Math.Cos(lat1) * Math.Sin(lat2) - Math.Sin(lat1) * Math.Cos(lat2) * Math.Cos(dLon);
            return (float)((Math.Atan2(y, x) * 180.0 / Math.PI + 360.0) % 360.0);
        }
    }
}
