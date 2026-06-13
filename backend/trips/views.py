import requests as http_requests
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .serializers import TripInputSerializer
from .services import ors_service
from .services.hos_engine import plan_trip, DayLog, Block


@api_view(['GET'])
def health_check(request):
    return Response({'status': 'ok'})


@api_view(['GET'])
def geocode_suggest(request):
    query = request.query_params.get('q', '').strip()
    if len(query) < 2:
        return Response({'suggestions': []})
    try:
        import requests as _req
        from django.conf import settings
        resp = _req.get(
            'https://api.openrouteservice.org/geocode/autocomplete',
            params={'api_key': settings.ORS_API_KEY, 'text': query, 'size': 5},
            timeout=5,
        )
        resp.raise_for_status()
        features = resp.json().get('features', [])
        suggestions = [f['properties'].get('label', '') for f in features]
        return Response({'suggestions': suggestions})
    except Exception:
        return Response({'suggestions': []})


@api_view(['POST'])
def plan_trip_view(request):
    serializer = TripInputSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    try:
        # 1. Geocode all three locations
        start_lon, start_lat = ors_service.geocode(data['current_location'])
        pickup_lon, pickup_lat = ors_service.geocode(data['pickup_location'])
        dropoff_lon, dropoff_lat = ors_service.geocode(data['dropoff_location'])

        # 2. Get full route: start → pickup → dropoff
        route = ors_service.get_route([
            (start_lon, start_lat),
            (pickup_lon, pickup_lat),
            (dropoff_lon, dropoff_lat),
        ])

        # 3. Get partial route: start → pickup (to know pickup_miles)
        leg1 = ors_service.get_route([
            (start_lon, start_lat),
            (pickup_lon, pickup_lat),
        ])

        total_miles = route['distance_meters'] / 1609.34
        pickup_miles = leg1['distance_meters'] / 1609.34

        # 4. Run HOS engine
        result = plan_trip(
            total_miles=total_miles,
            current_cycle_hours=data['current_cycle_hours'],
            start_location=data['current_location'],
            pickup_location=data['pickup_location'],
            dropoff_location=data['dropoff_location'],
            pickup_miles=pickup_miles,
        )

        # 5. Build response
        return Response({
            'route': {
                'geometry': route['geometry'],
                'total_miles': round(total_miles, 1),
                'total_duration_hrs': round(route['duration_seconds'] / 3600, 2),
                'stops': _build_stops(result['blocks'], start_lat, start_lon,
                                      pickup_lat, pickup_lon, dropoff_lat, dropoff_lon),
            },
            'schedule': {
                'total_driving_hrs': result['total_driving_hrs'],
                'total_trip_hrs': result['total_trip_hrs'],
                'total_days': len(result['days']),
                'days': [_serialize_day(day, i) for i, day in enumerate(result['days'])],
            },
        })

    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except http_requests.HTTPError as e:
        return Response(
            {'error': f'Routing service error: {e.response.status_code}'},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except Exception as e:
        return Response({'error': f'Unexpected error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _build_stops(blocks: list[Block], start_lat, start_lon, pickup_lat, pickup_lon, dropoff_lat, dropoff_lon):
    stops = [
        {'type': 'start', 'lat': start_lat, 'lon': start_lon,
         'time': blocks[0].start.isoformat() if blocks else None, 'label': 'Start'},
        {'type': 'pickup', 'lat': pickup_lat, 'lon': pickup_lon,
         'time': _find_block_time(blocks, 'Pickup'), 'label': 'Pickup'},
        {'type': 'dropoff', 'lat': dropoff_lat, 'lon': dropoff_lon,
         'time': _find_block_time(blocks, 'Dropoff'), 'label': 'Dropoff'},
    ]
    for b in blocks:
        if b.note and 'rest' in b.note.lower():
            stops.append({
                'type': 'rest',
                'lat': None, 'lon': None,
                'time': b.start.isoformat(),
                'label': 'Rest stop',
            })
        elif b.note and 'fuel' in b.note.lower():
            stops.append({
                'type': 'fuel',
                'lat': None, 'lon': None,
                'time': b.start.isoformat(),
                'label': b.note,
            })
    return stops


def _find_block_time(blocks: list[Block], note_keyword: str):
    for b in blocks:
        if b.note == note_keyword:
            return b.start.isoformat()
    return None


def _serialize_day(day: DayLog, index: int) -> dict:
    return {
        'day_number': index + 1,
        'date': day.date.isoformat(),
        'total_driving_hrs': round(day.total_driving, 2),
        'total_on_duty_hrs': round(day.total_on_duty, 2),
        'blocks': [
            {
                'status': b.status,
                'start': b.start.isoformat(),
                'end': b.end.isoformat(),
                'duration_hrs': round(b.duration_hrs, 4),
                'location': b.location,
                'note': b.note,
            }
            for b in day.blocks
        ],
    }
