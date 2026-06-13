"""
HOS Logic Engine — 70hr/8-day cycle, property-carrying driver, no adverse conditions.

Key constants:
  MAX_DRIVING_PER_SHIFT   = 11 hrs
  MAX_WINDOW              = 14 hrs  (consecutive on-duty/driving after 10-hr rest)
  BREAK_AFTER_DRIVING     = 8 hrs   (cumulative; requires 30-min off-duty break)
  MIN_REST                = 10 hrs  (off-duty before next window)
  CYCLE_LIMIT             = 70 hrs  (on-duty in rolling 8-day window)
  RESTART                 = 34 hrs  (off-duty to reset 70-hr counter)
  AVG_SPEED_MPH           = 55
  FUEL_INTERVAL_MI        = 1000
  FUEL_STOP_HRS           = 0.5
  PICKUP_HRS              = 1.0
  DROPOFF_HRS             = 1.0
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal
from datetime import datetime, timedelta, date

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

Status = Literal['off_duty', 'sleeper_berth', 'driving', 'on_duty']

@dataclass
class Block:
    status: Status
    start: datetime   # UTC-naive; treated as driver local clock
    end: datetime
    location: str = ''
    note: str = ''

    @property
    def duration_hrs(self) -> float:
        return (self.end - self.start).total_seconds() / 3600


@dataclass
class DayLog:
    date: date
    blocks: list[Block] = field(default_factory=list)

    @property
    def total_driving(self) -> float:
        return sum(b.duration_hrs for b in self.blocks if b.status == 'driving')

    @property
    def total_on_duty(self) -> float:
        return sum(
            b.duration_hrs for b in self.blocks
            if b.status in ('driving', 'on_duty')
        )


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_DRIVE = 11.0
MAX_WINDOW = 14.0
BREAK_THRESHOLD = 8.0
BREAK_DURATION = 0.5
MIN_REST = 10.0
CYCLE_LIMIT = 70.0
RESTART_HRS = 34.0
AVG_SPEED = 55.0
FUEL_INTERVAL = 1000.0
FUEL_STOP = 0.5
PICKUP_HRS = 1.0
DROPOFF_HRS = 1.0


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

def plan_trip(
    total_miles: float,
    current_cycle_hours: float,
    start_location: str,
    pickup_location: str,
    dropoff_location: str,
    pickup_miles: float,       # miles from start to pickup
    start_time: datetime | None = None,
) -> dict:
    """
    Build a complete HOS-compliant schedule for a trip.

    Returns:
      {
        'days': [DayLog, ...],
        'blocks': [Block, ...],   # flat list, same objects
        'total_driving_hrs': float,
        'total_trip_hrs': float,
      }
    """
    if start_time is None:
        # Default: start at 08:00 today
        now = datetime.utcnow().replace(hour=8, minute=0, second=0, microsecond=0)
        start_time = now

    # Miles from pickup to dropoff
    delivery_miles = total_miles - pickup_miles

    # Build a segment list: [(miles, type, location_name), ...]
    # Fuel stops inserted automatically every FUEL_INTERVAL miles
    segments = _build_segments(
        pickup_miles, delivery_miles,
        start_location, pickup_location, dropoff_location
    )

    # Rolling 8-day on-duty hours; seed with current cycle
    cycle_hours = current_cycle_hours

    all_blocks: list[Block] = []
    cursor = start_time

    # State within the current 14-hr window
    window_start: datetime | None = None   # when current window opened
    drive_since_break: float = 0.0         # cumulative driving since last 30-min break
    drive_this_window: float = 0.0         # driving hours used in current window

    def window_elapsed() -> float:
        if window_start is None:
            return 0.0
        return (cursor - window_start).total_seconds() / 3600

    def open_window():
        nonlocal window_start, drive_since_break, drive_this_window
        window_start = cursor
        drive_since_break = 0.0
        drive_this_window = 0.0

    def add_block(status: Status, hours: float, location: str = '', note: str = '') -> Block:
        nonlocal cursor, cycle_hours
        start = cursor
        end = cursor + timedelta(hours=hours)
        b = Block(status=status, start=start, end=end, location=location, note=note)
        all_blocks.append(b)
        cursor = end
        if status in ('driving', 'on_duty'):
            cycle_hours += hours
        return b

    def take_rest(hours: float, location: str = '', note: str = ''):
        nonlocal window_start, drive_since_break, drive_this_window
        add_block('off_duty', hours, location=location, note=note)
        if hours >= MIN_REST:
            window_start = None
            drive_since_break = 0.0
            drive_this_window = 0.0

    def check_34hr_restart(location: str):
        nonlocal cycle_hours
        if cycle_hours >= CYCLE_LIMIT:
            add_block('off_duty', RESTART_HRS, location=location,
                      note='34-hour restart — 70-hr cycle limit reached')
            cycle_hours = 0.0
            open_window()

    # Open the first window
    open_window()

    for seg_miles, seg_type, seg_location in segments:
        if seg_type == 'pickup':
            # 1-hr on-duty not driving at pickup
            check_34hr_restart(seg_location)
            _ensure_window_available(
                cursor, window_start, drive_this_window,
                drive_since_break, 0, PICKUP_HRS,
                add_block, take_rest, open_window, seg_location
            )
            if window_start is None:
                open_window()
            add_block('on_duty', PICKUP_HRS, location=seg_location, note='Pickup')
            drive_this_window  # unchanged — on_duty not driving doesn't count toward drive limits

        elif seg_type == 'dropoff':
            check_34hr_restart(seg_location)
            _ensure_window_available(
                cursor, window_start, drive_this_window,
                drive_since_break, 0, DROPOFF_HRS,
                add_block, take_rest, open_window, seg_location
            )
            if window_start is None:
                open_window()
            add_block('on_duty', DROPOFF_HRS, location=seg_location, note='Dropoff')

        elif seg_type == 'fuel':
            check_34hr_restart(seg_location)
            _ensure_window_available(
                cursor, window_start, drive_this_window,
                drive_since_break, 0, FUEL_STOP,
                add_block, take_rest, open_window, seg_location
            )
            if window_start is None:
                open_window()
            add_block('on_duty', FUEL_STOP, location=seg_location, note='Fuel stop')

        elif seg_type == 'drive':
            miles_remaining = seg_miles
            while miles_remaining > 0:
                check_34hr_restart(seg_location)
                if window_start is None:
                    open_window()

                # How much can we drive right now?
                drive_left_in_window = MAX_DRIVE - drive_this_window
                window_time_left = MAX_WINDOW - window_elapsed()
                # Window time left minus any pending on-duty = driveable time in window
                driveable_in_window = min(drive_left_in_window, window_time_left)

                # Break check: if we're at/past the break threshold, take break first
                if drive_since_break >= BREAK_THRESHOLD:
                    add_block('off_duty', BREAK_DURATION,
                              location=seg_location, note='30-min break')
                    drive_since_break = 0.0

                drive_before_break = BREAK_THRESHOLD - drive_since_break
                max_drive_chunk = min(driveable_in_window, drive_before_break, miles_remaining / AVG_SPEED)

                if max_drive_chunk <= 0:
                    # Window exhausted — take 10-hr rest
                    take_rest(MIN_REST, location=seg_location, note='10-hr rest')
                    open_window()
                    continue

                hrs_to_drive = min(max_drive_chunk, miles_remaining / AVG_SPEED)
                miles_driven = hrs_to_drive * AVG_SPEED

                add_block('driving', hrs_to_drive, location=seg_location)
                drive_this_window += hrs_to_drive
                drive_since_break += hrs_to_drive
                miles_remaining -= miles_driven

                # If we've used the full 11-hr or 14-hr window, rest
                if drive_this_window >= MAX_DRIVE or window_elapsed() >= MAX_WINDOW:
                    take_rest(MIN_REST, location=seg_location, note='10-hr rest')
                    open_window()

    # Final 10-hr rest after last delivery
    if all_blocks and all_blocks[-1].status != 'off_duty':
        add_block('off_duty', MIN_REST, location=dropoff_location, note='End of trip')

    days = _group_by_day(all_blocks, start_time)
    total_driving = sum(b.duration_hrs for b in all_blocks if b.status == 'driving')
    total_trip = (all_blocks[-1].end - all_blocks[0].start).total_seconds() / 3600 if all_blocks else 0

    return {
        'days': days,
        'blocks': all_blocks,
        'total_driving_hrs': round(total_driving, 2),
        'total_trip_hrs': round(total_trip, 2),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_segments(
    pickup_miles: float,
    delivery_miles: float,
    start_loc: str,
    pickup_loc: str,
    dropoff_loc: str,
) -> list[tuple[float, str, str]]:
    """
    Return ordered list of (miles, type, location) segments.
    Types: 'drive', 'pickup', 'dropoff', 'fuel'
    Fuel stops injected every FUEL_INTERVAL miles during driving segments.
    """
    segments = []

    # Drive to pickup
    segments += _split_drive_with_fuel(pickup_miles, start_loc, pickup_loc)
    # Pickup activity
    segments.append((0, 'pickup', pickup_loc))
    # Drive to dropoff
    segments += _split_drive_with_fuel(delivery_miles, pickup_loc, dropoff_loc)
    # Dropoff activity
    segments.append((0, 'dropoff', dropoff_loc))

    return segments


def _split_drive_with_fuel(
    total_miles: float, from_loc: str, to_loc: str
) -> list[tuple[float, str, str]]:
    """Break a driving segment into chunks with fuel stops every FUEL_INTERVAL miles."""
    segments = []
    remaining = total_miles
    fueled_at = 0.0

    while remaining > 0:
        miles_to_next_fuel = FUEL_INTERVAL - fueled_at
        if remaining <= miles_to_next_fuel:
            segments.append((remaining, 'drive', to_loc))
            fueled_at += remaining
            remaining = 0
        else:
            segments.append((miles_to_next_fuel, 'drive', to_loc))
            segments.append((0, 'fuel', f'Fuel stop near {to_loc}'))
            remaining -= miles_to_next_fuel
            fueled_at = 0.0

    return segments


def _ensure_window_available(
    cursor, window_start, drive_this_window, drive_since_break,
    extra_drive_hrs, extra_on_duty_hrs,
    add_block_fn, take_rest_fn, open_window_fn, location
):
    """Take a rest break if the current window can't accommodate the next activity."""
    if window_start is None:
        return

    elapsed = (cursor - window_start).total_seconds() / 3600
    window_remaining = MAX_WINDOW - elapsed
    drive_remaining = MAX_DRIVE - drive_this_window

    needs_rest = (
        window_remaining < (extra_drive_hrs + extra_on_duty_hrs)
        or drive_remaining < extra_drive_hrs
    )
    if needs_rest:
        take_rest_fn(MIN_REST, location=location, note='10-hr rest')
        open_window_fn()


def _group_by_day(blocks: list[Block], trip_start: datetime) -> list[DayLog]:
    """Group blocks into DayLog objects by calendar date."""
    day_map: dict[date, DayLog] = {}

    for block in blocks:
        # A block may span midnight — split it at day boundaries
        cursor = block.start
        while cursor < block.end:
            day = cursor.date()
            next_midnight = datetime(day.year, day.month, day.day) + timedelta(days=1)
            chunk_end = min(block.end, next_midnight)

            if day not in day_map:
                day_map[day] = DayLog(date=day)

            day_map[day].blocks.append(Block(
                status=block.status,
                start=cursor,
                end=chunk_end,
                location=block.location,
                note=block.note,
            ))
            cursor = chunk_end

    return [day_map[d] for d in sorted(day_map)]
