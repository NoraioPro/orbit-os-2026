# ORBIT OS — Google Earth Engine collection

`collect.py` pulls Sentinel-2 NDVI composites + scene counts for three gazetteer AOIs
(Oslo, Sahel, California) and prints JSON. It is the GEE half of the "planned" connectors
(SMAP, GPM, MODIS/VIIRS NDVI, HLS) — the Earth Engine API can serve all of them once the
account is set up.

## What you must do (account owner)

1. Go to https://console.cloud.google.com and create (or choose) a project.
2. Enable the **Earth Engine API** for that project.
3. Create a **Service Account** (IAM → Service Accounts → Create) and download its JSON key.
4. Register that service account at https://code.earthengine.google.com/register
   (this is the step people miss — GEE must accept the service account before any call works).
5. On the machine:
   ```bash
   pip install earthengine-api
   export GEE_SERVICE_ACCOUNT=/path/to/service-account-key.json
   export GEE_PROJECT=ee-your-project-id
   python collect.py
   ```

## Notes

- Earth Engine has **commercial licensing terms** for non-research use (flagged in the
  ORBIT OS PRD). This script is for the hackathon/research demo.
- The script only aggregates statistics (mean NDVI, scene count). It never downloads raw
  pixels into the app.
- Without a registered service account, `ee.Initialize` fails — that is expected and is
  reported, not papered over.
