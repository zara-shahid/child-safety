"""
EPCID External Services

Service integrations for external APIs:
- FHIRService: SMART on FHIR integration for EHR data
- MedlinePlusService: Health education content
- OpenFDAService: Drug labels and adverse events
- AirQualityService: Air quality data (AirNow, OpenAQ)
- WeatherService: Weather and climate data (NOAA, OpenWeather)
"""

from .air_quality_service import AirQualityService
from .fhir_service import FHIRService
from .medlineplus_service import MedlinePlusService
from .openfda_service import OpenFDAService
from .weather_service import WeatherService

__all__ = [
    "FHIRService",
    "MedlinePlusService",
    "OpenFDAService",
    "AirQualityService",
    "WeatherService",
]
