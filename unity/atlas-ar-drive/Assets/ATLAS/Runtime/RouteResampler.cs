using System.Collections.Generic;

namespace Atlas.ArDrive
{
    public static class RouteResampler
    {
        public static List<GeoPoint> EveryMeters(IReadOnlyList<GeoPoint> input, double spacingM = 8, double maxDistanceM = 140)
        {
            var output = new List<GeoPoint>();
            if (input == null || input.Count == 0) return output;

            output.Add(input[0]);
            double accumulated = 0;
            double emitted = 0;

            for (int i = 1; i < input.Count; i++)
            {
                GeoPoint a = input[i - 1];
                GeoPoint b = input[i];
                double segment = GeoMath.DistanceMeters(a, b);
                if (segment <= 0.01) continue;

                double cursor = spacingM - (accumulated - emitted);
                while (cursor <= segment)
                {
                    double t = cursor / segment;
                    var p = new GeoPoint(
                        a.lat + (b.lat - a.lat) * t,
                        a.lon + (b.lon - a.lon) * t,
                        a.alt + (b.alt - a.alt) * t
                    );
                    output.Add(p);
                    emitted += spacingM;
                    if (emitted >= maxDistanceM) return output;
                    cursor += spacingM;
                }
                accumulated += segment;
            }

            if (output.Count == 1 && input.Count > 1) output.Add(input[input.Count - 1]);
            return output;
        }
    }
}
