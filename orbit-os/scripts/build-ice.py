#!/usr/bin/env python3
"""
Build the Svalbard / European-Arctic ice data used by ORBIT OS.

Sources (all public, no key):
  1. Norwegian Ice Service (MET Norway) ice chart, SIGRID-3 shapefile
     https://cryo.met.no/sites/cryo/files/latest/NIS_arctic_latest_pl_a.zip
     -> vector polygons with total concentration (CT), stage of development and
        NIS_CLASS. Parsed here into simplified rings + per-class areas. Nothing
        is interpolated: areas come from the polygon geometry itself
        (equirectangular shoelace at each ring's mean latitude).
  2. Chart quicklook archive 1997-2026
     https://cryo.met.no/archive/ice-service/icecharts/quicklooks/<year>/<date>/
     -> the analyst's own PNG charts, used for the before/after strip.
  3. NSIDC Sea Ice Index v4.0, regional monthly area/extent (km^2), 1978-present
     https://noaadata.apps.nsidc.org/NOAA/G02135/seaice_analysis/
     -> trend statistics for the Barents, Greenland and Kara seas around Svalbard.

Outputs
  public/data/ice/chart.json     latest chart: metadata, stats, simplified rings
  public/data/ice/trends.json    monthly regional series + computed statistics
  public/data/ice/archive.json   verified quicklook URLs for the compare strip
"""
from __future__ import annotations

import io
import json
import math
import os
import re
import struct
import urllib.request
import zipfile
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "data", "ice")
CACHE = os.path.join(ROOT, ".cache", "ice")
UA = {"User-Agent": "ORBIT OS research (space apps)"}
TIMEOUT = 180

# the window the Svalbard board is about: Fram Strait, Svalbard, northern Barents
WINDOW = {"minLon": -25.0, "minLat": 68.0, "maxLon": 45.0, "maxLat": 85.0}

CLASS_COLORS = {
    "Fast Ice": "#7dd3fc",
    "Very Close Drift Ice": "#dc2626",
    "Close Drift Ice": "#f97316",
    "Open Drift Ice": "#facc15",
    "Very Open Drift Ice": "#a3e635",
    "Open Water": "#38bdf8",
    "Ice Free": "#1e293b",
}

REGIONS = [
    ("barents", "Barents Sea"),
    ("greenland", "Greenland Sea"),
    ("kara", "Kara Sea"),
]
SHEET_REL = {
    "Barents-Area-km^2": 3,
    "Barents-Extent-km^2": 4,
    "Greenland-Area-km^2": 17,
    "Greenland-Extent-km^2": 18,
    "Kara-Area-km^2": 21,
    "Kara-Extent-km^2": 22,
}
CLIM_START, CLIM_END = 1991, 2020


def ensure(path: str) -> str:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read()


def cached(name: str, url: str) -> bytes:
    path = ensure(os.path.join(CACHE, name))
    if os.path.exists(path) and os.path.getsize(path) > 1024:
        return open(path, "rb").read()
    data = fetch(url)
    open(path, "wb").write(data)
    return data


# --------------------------------------------------------------------------- #
# 1. SIGRID-3 chart
# --------------------------------------------------------------------------- #
def read_dbf(blob: bytes):
    nrec, hlen, rlen = struct.unpack("<IHH", blob[4:12])
    fields, p = [], 32
    while blob[p] != 0x0D:
        fields.append((blob[p:p + 11].split(b"\0")[0].decode("latin-1"), chr(blob[p + 11]), blob[p + 16]))
        p += 32
    recs = []
    for i in range(nrec):
        rec = blob[hlen + i * rlen: hlen + (i + 1) * rlen]
        if rec[:1] == b"*":
            continue
        vals, q = {}, 1
        for name, ftype, flen in fields:
            raw = rec[q:q + flen].decode("latin-1").strip()
            q += flen
            if ftype in "NF":
                try:
                    vals[name] = float(raw) if raw else None
                except ValueError:
                    vals[name] = raw
            else:
                vals[name] = raw
        recs.append(vals)
    return recs


def read_shapefile(blob: bytes):
    """Return [(ring_lonlat_list, ...)] per polygon shape, plus bbox."""
    p, shapes = 100, []
    while p < len(blob):
        recno, clen = struct.unpack(">ii", blob[p:p + 8])
        body = blob[p + 8:p + 8 + clen * 2]
        stype = struct.unpack("<i", body[:4])[0]
        if stype == 5:
            nparts, npoints = struct.unpack("<ii", body[36:44])
            parts = struct.unpack(f"<{nparts}i", body[44:44 + 4 * nparts])
            base = 44 + 4 * nparts
            pts = struct.unpack(f"<{2 * npoints}d", body[base:base + 16 * npoints])
            rings = []
            for k in range(nparts):
                s = parts[k]
                e = parts[k + 1] if k + 1 < nparts else npoints
                rings.append([(pts[2 * i], pts[2 * i + 1]) for i in range(s, e)])
            shapes.append(rings)
        p += 8 + clen * 2
    return shapes


def ring_area_km2(ring):
    if len(ring) < 3:
        return 0.0
    latm = sum(pt[1] for pt in ring) / len(ring)
    kx = 111.32 * math.cos(math.radians(min(89.0, abs(latm))))
    ky = 110.57
    a = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        a += (x1 * kx) * (y2 * ky) - (x2 * kx) * (y1 * ky)
    return abs(a) / 2.0


def clip_window(ring):
    inside = [pt for pt in ring if WINDOW["minLon"] <= pt[0] <= WINDOW["maxLon"] and WINDOW["minLat"] <= pt[1] <= WINDOW["maxLat"]]
    return inside


def simplify(ring, max_points=90, min_step=0.045):
    """thin by distance so the JSON stays small but the outline keeps its shape"""
    if not ring:
        return []
    out = [ring[0]]
    for pt in ring[1:]:
        if abs(pt[0] - out[-1][0]) + abs(pt[1] - out[-1][1]) >= min_step:
            out.append(pt)
    if out[-1] != ring[-1]:
        out.append(ring[-1])
    if len(out) > max_points:
        step = len(out) / max_points
        out = [out[int(i * step)] for i in range(max_points)]
    return [[round(x, 3), round(y, 3)] for x, y in out]


def build_chart():
    blob = cached("NIS_arctic_latest_pl_a.zip", "https://cryo.met.no/sites/cryo/files/latest/NIS_arctic_latest_pl_a.zip")
    z = zipfile.ZipFile(io.BytesIO(blob))
    stem = [n for n in z.namelist() if n.endswith(".shp")][0].rsplit(".", 1)[0]
    recs = read_dbf(z.read(stem + ".dbf"))
    shapes = read_shapefile(z.read(stem + ".shp"))
    meta_xml = z.read(stem + ".xml").decode("utf-8", "ignore")

    issue = re.search(r"<pubdate>(\d{8})</pubdate>", meta_xml)
    beg = re.search(r"<begdate>(\d{8})</begdate>", meta_xml)
    end = re.search(r"<enddate>(\d{8})</enddate>", meta_xml)
    sensors = re.search(r"<abstract>(.*?)</abstract>", meta_xml, re.S)
    fmt = lambda d: f"{d[0:4]}-{d[4:6]}-{d[6:8]}" if d else None

    classes = {}
    rings = []
    for rec, shape in zip(recs, shapes):
        cls = (rec.get("NIS_CLASS") or "unknown").strip()
        raw_ct = rec.get("CT")
        ct = None
        if isinstance(raw_ct, (int, float)) and raw_ct >= 0:
            ct = float(raw_ct)
        elif isinstance(raw_ct, str):
            m = re.match(r"\s*(\d+)", raw_ct)
            ct = float(m.group(1)) if m else None
        area_all = 0.0
        for ring in shape:
            area_all += ring_area_km2(ring)
        c = classes.setdefault(cls, {"nis_class": cls, "ct": ct, "polygons": 0, "area_km2": 0.0,
                                     "area_in_window_km2": 0.0, "color": CLASS_COLORS.get(cls, "#64748b")})
        c["polygons"] += 1
        c["area_km2"] += area_all
        # SIGRID-3 CT is concentration in tenths x10 (92 = 9.2/10); weight the area by it
        c["ice_covered_km2"] = c.get("ice_covered_km2", 0.0) + area_all * (ct / 100.0 if ct else 0.0)
        clipped = [clip_window(r) for r in shape]
        clipped = [c2 for c2 in clipped if len(c2) >= 3]
        if clipped:
            win = sum(ring_area_km2(c2) for c2 in clipped)
            c["area_in_window_km2"] += win
            c["ice_covered_in_window_km2"] = c.get("ice_covered_in_window_km2", 0.0) + win * (ct / 100.0 if ct else 0.0)
            for c2 in clipped:
                simple = simplify(c2)
                if len(simple) >= 4:
                    rings.append({"cls": cls, "ct": ct, "pts": simple})

    ice_classes = [c for c in classes.values() if c["ct"] and c["ct"] > 0]
    total_ice = sum(c["area_km2"] for c in ice_classes)
    total_ice_win = sum(c["area_in_window_km2"] for c in ice_classes)
    covered = sum(c.get("ice_covered_km2", 0.0) for c in ice_classes)
    covered_win = sum(c.get("ice_covered_in_window_km2", 0.0) for c in ice_classes)

    # where the ice edge sits inside the window, by longitude slice
    edge = []
    for lon_lo in range(-20, 45, 5):
        lat_min = 90.0
        for r in rings:
            if r["ct"] and r["ct"] > 0:
                for lon, lat in r["pts"]:
                    if lon_lo <= lon < lon_lo + 5 and lat < lat_min:
                        lat_min = lat
        if lat_min < 90.0:
            edge.append({"lon_from": lon_lo, "lon_to": lon_lo + 5, "south_edge_lat": round(lat_min, 2)})

    return {
        "domain": "ice-chart",
        "title": "Norwegian Ice Service chart · European Arctic",
        "issued": fmt(issue.group(1)) if issue else None,
        "valid_from": fmt(beg.group(1)) if beg else None,
        "valid_to": fmt(end.group(1)) if end else None,
        "producer": "Norwegian Ice Service (MET Norway)",
        "chart_id": stem,
        "source_url": "https://cryo.met.no/en/latest-ice-charts",
        "download_url": "https://cryo.met.no/sites/cryo/files/latest/NIS_arctic_latest_pl_a.zip",
        "format": "SIGRID-3 shapefile (ESRI), EPSG:4326",
        "analyst_note": (sensors.group(1).strip()[:600] if sensors else None),
        "window": WINDOW,
        "counts": {"polygons": len(recs), "rings_in_window": len(rings)},
        "totals": {
            "charted_zone_km2": round(total_ice),
            "ice_covered_km2": round(covered),
            "charted_zone_in_window_km2": round(total_ice_win),
            "ice_covered_in_window_km2": round(covered_win),
            "classes": len(classes),
        },
        "classes": sorted(classes.values(), key=lambda c: -(c["area_km2"] or 0)),
        "ice_edge": edge,
        "rings": rings,
        "provenance": {
            "provider": "MET Norway / Norwegian Ice Service",
            "access": "keyless direct download (zip + shapefile)",
            "honesty": (
                "Polygon areas are computed from the chart geometry (equirectangular shoelace, "
                "floored at each ring's mean latitude) — no pixel inference. Concentration is the "
                "chart's CT attribute, not an ORBIT estimate. Rings are thinned for display only."
            ),
        },
    }


# --------------------------------------------------------------------------- #
# 2. NSIDC regional monthly trends
# --------------------------------------------------------------------------- #
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def read_xlsx_sheet(blob: bytes, index: int):
    import xml.etree.ElementTree as ET
    z = zipfile.ZipFile(io.BytesIO(blob))
    root = ET.fromstring(z.read(f"xl/worksheets/sheet{index}.xml"))
    rows = {}
    for row in root.iter(NS + "row"):
        cells = {}
        for c in row.iter(NS + "c"):
            ref = c.get("r")
            col = re.match(r"([A-Z]+)", ref).group(1)
            v = c.find(NS + "v")
            if v is None or v.text is None:
                continue
            try:
                cells[col] = float(v.text)
            except ValueError:
                cells[col] = v.text
        rows[int(row.get("r"))] = cells
    return rows


def col_letter(i: int) -> str:
    s = ""
    while i > 0:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def slope_per_decade(points):
    """least squares on (year, value); returns km^2 per decade"""
    n = len(points)
    if n < 10:
        return None
    mx = sum(p[0] for p in points) / n
    my = sum(p[1] for p in points) / n
    num = sum((p[0] - mx) * (p[1] - my) for p in points)
    den = sum((p[0] - mx) ** 2 for p in points)
    return (num / den) * 10 if den else None


def build_trends():
    blob = cached("nsidc_regional_monthly.xlsx",
                  "https://noaadata.apps.nsidc.org/NOAA/G02135/seaice_analysis/N_Sea_Ice_Index_Regional_Monthly_Data_G02135_v4.0.xlsx")
    out_regions = []
    for rid, label in REGIONS:
        area_rows = read_xlsx_sheet(blob, SHEET_REL[f"{'Barents' if rid=='barents' else 'Greenland' if rid=='greenland' else 'Kara'}-Area-km^2"])
        ext_rows = read_xlsx_sheet(blob, SHEET_REL[f"{'Barents' if rid=='barents' else 'Greenland' if rid=='greenland' else 'Kara'}-Extent-km^2"])

        def series(rows):
            months = {m: [] for m in range(1, 13)}
            for rnum, cells in rows.items():
                year = cells.get("A")
                if not isinstance(year, float) or year < 1978:
                    continue
                for m in range(1, 13):
                    area = cells.get(col_letter(2 + (m - 1) * 2))
                    if isinstance(area, float):
                        months[m].append([int(year), round(area, 1)])
            return months

        area_months, ext_months = series(area_rows), series(ext_rows)

        stats = []
        for m in range(1, 13):
            pts = area_months[m]
            if not pts:
                continue
            clim = [v for y, v in pts if CLIM_START <= y <= CLIM_END]
            latest_year, latest = pts[-1]
            mean_clim = sum(clim) / len(clim) if clim else None
            stats.append({
                "month": m,
                "slope_km2_per_decade": round(slope_per_decade(pts) or 0),
                "pct_per_decade": round(((slope_per_decade(pts) or 0) / mean_clim) * 100, 1) if mean_clim else None,
                "climatology_1991_2020_km2": round(mean_clim) if mean_clim else None,
                "latest_year": latest_year,
                "latest_km2": round(latest),
                "anomaly_vs_climatology_km2": round(latest - mean_clim) if mean_clim else None,
            })

        # two-era comparison: 1979-2000 vs 2007-2026, per month
        era = []
        for m in range(1, 13):
            pts = area_months[m]
            early = [v for y, v in pts if 1979 <= y <= 2000]
            late = [v for y, v in pts if 2007 <= y <= pts[-1][0]]
            if early and late:
                era.append({"month": m,
                            "early_mean_km2": round(sum(early) / len(early)),
                            "late_mean_km2": round(sum(late) / len(late)),
                            "change_km2": round(sum(late) / len(late) - sum(early) / len(early)),
                            "change_pct": round((sum(late) / len(late) - sum(early) / len(early)) / (sum(early) / len(early)) * 100, 1)})

        annual = []
        for y in range(1978, area_months[1][-1][0] + 1):
            vals = [v for m in range(1, 13) for yy, v in area_months[m] if yy == y]
            if len(vals) >= 6:
                annual.append([y, round(sum(vals))])

        minimum = min(([y, round(v)] for y, v in annual), default=None, key=lambda p: p[1]) if annual else None
        out_regions.append({
            "id": rid,
            "label": label,
            "area_months": {str(m): area_months[m] for m in range(1, 13)},
            "extent_months": {str(m): ext_months[m] for m in range(1, 13)},
            "annual_mean": annual,
            "stats_by_month": stats,
            "era_change": era,
        })

    return {
        "domain": "ice-trends",
        "title": "Sea-ice area trend · Barents, Greenland, Kara seas",
        "source": "NSIDC Sea Ice Index v4.0, regional monthly",
        "source_url": "https://noaadata.apps.nsidc.org/NOAA/G02135/seaice_analysis/N_Sea_Ice_Index_Regional_Monthly_Data_G02135_v4.0.xlsx",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "climatology": f"{CLIM_START}-{CLIM_END}",
        "method": (
            "Monthly ice area (km^2) per sea-ice region as published by NSIDC. Trends are ordinary "
            "least squares on the monthly series and are quoted per decade; era comparison contrasts "
            "1979-2000 with 2007-latest. Nothing is smoothed, gap-filled or extrapolated."
        ),
        "regions": out_regions,
        "provenance": {
            "provider": "NSIDC / NOAA",
            "access": "keyless direct download (xlsx)",
            "honesty": "Figures are read straight from the NSIDC workbook; ORBIT only computes the fits and anomalies.",
        },
    }


# --------------------------------------------------------------------------- #
# 3. quicklook archive strip
# --------------------------------------------------------------------------- #
QA = "https://cryo.met.no/archive/ice-service/icecharts/quicklooks"


def list_dir(url: str):
    try:
        html = fetch(url).decode("utf-8", "ignore")
    except Exception:
        return []
    return sorted({m for m in re.findall(r'href="([^"#?]+)"', html) if m not in ("/en", "/en/home")})


def nearest_dir(year: int, monthday: str):
    for cand in list_dir(f"{QA}/{year}/"):
        if cand.endswith("/") and cand.startswith(str(year)):
            d = cand.strip("/")
            if len(d) == 8 and d[4:8] >= monthday:
                return d
    return None


def build_archive():
    strip = []
    for year, monthday in [(2005, "0215"), (2010, "0215"), (2015, "0215"), (2020, "0215"), (2025, "0215"), (2026, "0215")]:
        d = nearest_dir(year, monthday)
        if not d:
            continue
        base = f"{QA}/{year}/{d}"
        files = list_dir(base + "/")
        for region, fname in [("barent", f"barent_{d}_col.png"), ("framst", f"framst_{d}_col.png"),
                              ("isfjrd", f"isfjrd_{d}_col.png"), ("arctic", f"arctic_{d}_col.png")]:
            if fname in files:
                strip.append({"date": f"{d[0:4]}-{d[4:6]}-{d[6:8]}", "region": region,
                              "url": f"{base}/{fname}"})
    return {
        "domain": "ice-archive",
        "title": "Ice-chart quicklooks · mid-February each year",
        "note": "The analyst's own published chart images, one per year, same week of year — a like-for-like visual comparison, not an ORBIT rendering.",
        "source_url": f"{QA}/",
        "images": strip,
        "provenance": {"provider": "MET Norway / Norwegian Ice Service", "access": "keyless", "honesty": "Unmodified published quicklooks."},
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    chart = build_chart()
    json.dump(chart, open(os.path.join(OUT, "chart.json"), "w", encoding="utf-8"), indent=1)
    print(f"chart: {chart['counts']['polygons']} polygons, {chart['totals']['ice_covered_km2']:,} km2 ice-covered, "
          f"{len(chart['rings'])} rings in window, issued {chart['issued']}")

    trends = build_trends()
    json.dump(trends, open(os.path.join(OUT, "trends.json"), "w", encoding="utf-8"), indent=1)
    for r in trends["regions"]:
        sept = next((s for s in r["stats_by_month"] if s["month"] == 9), None)
        print(f"trends {r['label']}: Sep {sept['slope_km2_per_decade']:+,} km2/decade "
              f"({sept['pct_per_decade']}%/decade), latest Sep {sept['latest_year']} = {sept['latest_km2']:,} km2")

    archive = build_archive()
    json.dump(archive, open(os.path.join(OUT, "archive.json"), "w", encoding="utf-8"), indent=1)
    print(f"archive: {len(archive['images'])} quicklooks across {len({i['date'][:4] for i in archive['images']})} years")


if __name__ == "__main__":
    main()
