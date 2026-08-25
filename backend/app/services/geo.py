"""
KrishiRakshak — Geographic & Geohash Utilities

Provides geohash encoding/decoding and distance calculation utilities.
Uses python-geohash with a pure-Python fallback if the C-extension is unavailable.
"""

import math
from typing import Tuple

try:
    import geohash
except ImportError:
    # Pure Python fallback for geohash encoding if python-geohash package is not installed
    class _GeohashFallback:
        _base32 = '0123456789bcdefghjkmnpqrstuvwxyz'
        
        @classmethod
        def encode(cls, latitude: float, longitude: float, precision: int = 12) -> str:
            lat_interval = [-90.0, 90.0]
            lon_interval = [-180.0, 180.0]
            geohash_str = []
            bits = [16, 8, 4, 2, 1]
            bit = 0
            ch = 0
            even = True
            
            while len(geohash_str) < precision:
                if even:
                    mid = (lon_interval[0] + lon_interval[1]) / 2
                    if longitude > mid:
                        ch |= bits[bit]
                        lon_interval[0] = mid
                    else:
                        lon_interval[1] = mid
                else:
                    mid = (lat_interval[0] + lat_interval[1]) / 2
                    if latitude > mid:
                        ch |= bits[bit]
                        lat_interval[0] = mid
                    else:
                        lat_interval[1] = mid
                even = not even
                if bit < 4:
                    bit += 1
                else:
                    geohash_str.append(cls._base32[ch])
                    bit = 0
                    ch = 0
            return ''.join(geohash_str)

    geohash = _GeohashFallback()


def compute_geohash(latitude: float, longitude: float, precision: int = 12) -> str:
    """
    Encode latitude and longitude into a geohash string.
    
    Precision reference:
    - 5 chars: ~4.9 km × 4.9 km (used for regional outbreak clustering)
    - 6 chars: ~1.2 km × 0.6 km
    - 7 chars: ~152 m × 152 m
    - 12 chars: ~3.7 cm (exact point representation)
    """
    return geohash.encode(latitude, longitude, precision=precision)


def get_cluster_cell(geohash_str: str, precision: int = 5) -> str:
    """Return the prefix cell string for grouping nearby reports."""
    return geohash_str[:precision]


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two coordinates in kilometers."""
    r = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c
