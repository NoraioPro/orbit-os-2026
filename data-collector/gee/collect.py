#!/usr/bin/env python3
"""ORBIT OS — Google Earth Engine collection (Sentinel-2 NDVI composite).

Requires a GEE-enabled Google Cloud project and a service-account key that has been
registered with Earth Engine. This script exports *aggregated stats only* (mean NDVI +
scene count per AOI), not raw pixels, and it will not run without valid credentials.

Env vars:
  GEE_SERVICE_ACCOUNT  path to the service-account JSON key
  GEE_PROJECT          the GEE cloud project id, e.g. "ee-your-project"

Setup: see README.md
"""
import json
import os
import sys


def main() -> None:
    key = os.environ.get("GEE_SERVICE_ACCOUNT")
    project = os.environ.get("GEE_PROJECT")
    if not key or not project:
        print("Missing GEE_SERVICE_ACCOUNT / GEE_PROJECT. See README.md.")
        sys.exit(2)
    try:
        import ee
    except ImportError:
        print("`earthengine-api` not installed. Run: pip install earthengine-api")
        sys.exit(2)

    with open(key, "r", encoding="utf-8") as fh:
        key_json = json.load(fh)
    email = key_json.get("client_email")
    if not email:
        print("Service-account key is missing client_email.")
        sys.exit(2)

    ee.Initialize(ee.ServiceAccountCredentials(email, key), project=project)

    # AOIs (lon, lat) from the ORBIT OS gazetteer.
    aois = {
        "oslo": [10.75, 59.91],
        "sahel": [2.11, 13.51],
        "california": [-119.8, 36.7],
    }
    s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")

    out = {}
    for name, (lon, lat) in aois.items():
        pt = ee.Geometry.Point(lon, lat).buffer(5000)
        recent = (
            s2.filterBounds(pt)
            .filterDate("2026-01-01", "2026-11-14")
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
        )

        def add_ndvi(img):
            ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
            return img.addBands(ndvi)

        ndvi = recent.map(add_ndvi).select("NDVI").median().reduceRegion(ee.Reducer.mean(), pt, 30)
        out[name] = {
            "mean_ndvi": ndvi.getInfo().get("NDVI"),
            "scene_count": recent.size().getInfo(),
        }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
