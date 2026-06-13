import requests
from django.conf import settings

ORS_BASE = 'https://api.openrouteservice.org'


def geocode(address: str) -> tuple[float, float]:
    """Return (lon, lat) for a plain-text address via ORS geocoding.

    Uses autocomplete with size=5 and prefers routable layers (venue, street,
    localadmin) over administrative centroids (locality, region) which often
    land in parks or non-road areas and cause ORS routing to return 404.
    """
    resp = requests.get(
        f'{ORS_BASE}/geocode/autocomplete',
        params={'api_key': settings.ORS_API_KEY, 'text': address, 'size': 5},
        timeout=10,
    )
    resp.raise_for_status()
    features = resp.json().get('features', [])
    if not features:
        raise ValueError(f'Location not found: {address}')

    # Administrative centroids (locality/region/country) are often in parks or
    # open land — not on roads. Prefer layers that are more road-adjacent.
    ROUTABLE_LAYERS = {'address', 'venue', 'street', 'localadmin'}
    preferred = [f for f in features if f['properties'].get('layer') in ROUTABLE_LAYERS]
    best = preferred[0] if preferred else features[0]

    coords = best['geometry']['coordinates']  # [lon, lat]
    return coords[0], coords[1]


def get_route(waypoints: list[tuple[float, float]]) -> dict:
    """
    Return route info for an ordered list of (lon, lat) waypoints.
    Result: { distance_meters, duration_seconds, geometry (GeoJSON LineString) }
    """
    resp = requests.post(
        f'{ORS_BASE}/v2/directions/driving-hgv/geojson',
        headers={'Authorization': settings.ORS_API_KEY, 'Content-Type': 'application/json'},
        json={'coordinates': list(waypoints)},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    feature = data['features'][0]
    summary = feature['properties']['summary']
    return {
        'distance_meters': summary['distance'],
        'duration_seconds': summary['duration'],
        'geometry': feature['geometry'],
    }
