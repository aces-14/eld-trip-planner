/* Realistic mock API response for a Chicago → St. Louis → Dallas trip (~850 miles, 3 days) */
export const MOCK_TRIP = {
  route: {
    geometry: {
      type: 'LineString',
      coordinates: [
        [-87.6298, 41.8781],
        [-88.0, 41.5],
        [-89.0, 40.5],
        [-90.1994, 38.6270],
        [-90.5, 37.8],
        [-91.5, 36.5],
        [-92.3, 35.5],
        [-92.8, 35.0],
        [-94.0, 34.5],
        [-96.7970, 32.7767],
      ],
    },
    total_miles: 921.4,
    total_duration_hrs: 16.75,
    stops: [
      { type: 'start',   lat: 41.8781, lon: -87.6298, time: '2024-01-15T08:00:00', label: 'Chicago, IL' },
      { type: 'pickup',  lat: 38.6270, lon: -90.1994, time: '2024-01-15T13:49:00', label: 'Pickup — St. Louis, MO' },
      { type: 'rest',    lat: null,    lon: null,      time: '2024-01-15T22:00:00', label: 'Rest stop' },
      { type: 'fuel',    lat: null,    lon: null,      time: '2024-01-15T10:13:00', label: 'Fuel stop near St. Louis, MO' },
      { type: 'fuel',    lat: null,    lon: null,      time: '2024-01-16T10:43:00', label: 'Fuel stop near Dallas, TX' },
      { type: 'dropoff', lat: 32.7767, lon: -96.7970, time: '2024-01-16T18:37:00', label: 'Dropoff — Dallas, TX' },
    ],
  },
  schedule: {
    total_driving_hrs: 16.75,
    total_trip_hrs: 41.2,
    total_days: 3,
    days: [
      {
        day_number: 1,
        date: '2024-01-15',
        total_driving_hrs: 11.0,
        total_on_duty_hrs: 12.0,
        blocks: [
          { status: 'driving',  start: '2024-01-15T08:00:00', end: '2024-01-15T16:00:00', duration_hrs: 8.0,  location: 'Chicago, IL',   note: '' },
          { status: 'off_duty', start: '2024-01-15T16:00:00', end: '2024-01-15T16:30:00', duration_hrs: 0.5,  location: 'Near Springfield, IL', note: '30-min break' },
          { status: 'driving',  start: '2024-01-15T16:30:00', end: '2024-01-15T17:49:00', duration_hrs: 1.32, location: 'Near Springfield, IL', note: '' },
          { status: 'on_duty',  start: '2024-01-15T17:49:00', end: '2024-01-15T18:49:00', duration_hrs: 1.0,  location: 'St. Louis, MO', note: 'Pickup' },
          { status: 'driving',  start: '2024-01-15T18:49:00', end: '2024-01-15T22:00:00', duration_hrs: 3.18, location: 'St. Louis, MO', note: '' },
          { status: 'off_duty', start: '2024-01-15T22:00:00', end: '2024-01-16T08:00:00', duration_hrs: 10.0, location: 'Sikeston, MO',  note: '10-hr rest' },
        ],
      },
      {
        day_number: 2,
        date: '2024-01-16',
        total_driving_hrs: 5.75,
        total_on_duty_hrs: 7.25,
        blocks: [
          { status: 'off_duty', start: '2024-01-16T00:00:00', end: '2024-01-16T08:00:00', duration_hrs: 8.0,  location: 'Sikeston, MO',  note: '10-hr rest' },
          { status: 'on_duty',  start: '2024-01-16T08:00:00', end: '2024-01-16T08:30:00', duration_hrs: 0.5,  location: 'Sikeston, MO',  note: 'Fuel stop near Dallas, TX' },
          { status: 'driving',  start: '2024-01-16T08:30:00', end: '2024-01-16T14:15:00', duration_hrs: 5.75, location: 'Sikeston, MO',  note: '' },
          { status: 'on_duty',  start: '2024-01-16T14:15:00', end: '2024-01-16T15:15:00', duration_hrs: 1.0,  location: 'Dallas, TX',    note: 'Dropoff' },
          { status: 'off_duty', start: '2024-01-16T15:15:00', end: '2024-01-17T01:15:00', duration_hrs: 10.0, location: 'Dallas, TX',    note: 'End of trip' },
        ],
      },
      {
        day_number: 3,
        date: '2024-01-17',
        total_driving_hrs: 0,
        total_on_duty_hrs: 0,
        blocks: [
          { status: 'off_duty', start: '2024-01-17T00:00:00', end: '2024-01-17T01:15:00', duration_hrs: 1.25, location: 'Dallas, TX', note: 'End of trip' },
        ],
      },
    ],
  },
}
