"""
EPCID Air Quality Service

Integration with air quality APIs:
- AirNow (EPA): US air quality data
- OpenAQ: Global air quality data

Provides:
- Current AQI readings
- PM2.5 and ozone levels
- Air quality forecasts
- Health recommendations based on AQI
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, cast
from urllib.parse import urlencode

logger = logging.getLogger("epcid.services.air_quality")


@dataclass
class AirQualityReading:
    """An air quality reading."""

    aqi: int
    category: str
    pollutant: str
    value: float
    unit: str
    location: str
    timestamp: datetime
    source: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "aqi": self.aqi,
            "category": self.category,
            "pollutant": self.pollutant,
            "value": self.value,
            "unit": self.unit,
            "location": self.location,
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
        }


@dataclass
class AirQualityForecast:
    """Air quality forecast."""

    date: str
    aqi: int
    category: str
    pollutant: str
    discussion: str | None


class AirQualityService:
    """
    Service for air quality data from AirNow and OpenAQ.

    Provides current conditions, forecasts, and health guidance
    based on air quality levels.
    """

    AIRNOW_BASE_URL = "https://www.airnowapi.org/aq"
    OPENAQ_BASE_URL = "https://api.openaq.org/v2"

    # AQI categories and health implications
    AQI_CATEGORIES = {
        (0, 50): {
            "category": "Good",
            "color": "green",
            "health_message": "Air quality is satisfactory.",
            "sensitive_message": "No health implications.",
            "recommendation": "Enjoy outdoor activities.",
        },
        (51, 100): {
            "category": "Moderate",
            "color": "yellow",
            "health_message": "Air quality is acceptable.",
            "sensitive_message": "Unusually sensitive individuals may experience respiratory symptoms.",
            "recommendation": "Sensitive groups should consider reducing prolonged outdoor exertion.",
        },
        (101, 150): {
            "category": "Unhealthy for Sensitive Groups",
            "color": "orange",
            "health_message": "Members of sensitive groups may experience health effects.",
            "sensitive_message": "Children, elderly, and those with respiratory conditions should limit outdoor activity.",
            "recommendation": "Reduce prolonged or heavy outdoor exertion for sensitive groups.",
        },
        (151, 200): {
            "category": "Unhealthy",
            "color": "red",
            "health_message": "Everyone may begin to experience health effects.",
            "sensitive_message": "Children should avoid outdoor activity.",
            "recommendation": "Everyone should reduce prolonged outdoor exertion.",
        },
        (201, 300): {
            "category": "Very Unhealthy",
            "color": "purple",
            "health_message": "Health alert: everyone may experience more serious health effects.",
            "sensitive_message": "Children should remain indoors.",
            "recommendation": "Avoid all outdoor physical activity.",
        },
        (301, 500): {
            "category": "Hazardous",
            "color": "maroon",
            "health_message": "Health emergency: everyone more likely to be affected.",
            "sensitive_message": "Everyone should stay indoors.",
            "recommendation": "Stay indoors. Close windows. Use air purifier if available.",
        },
    }

    def __init__(
        self,
        airnow_api_key: str | None = None,
        openaq_api_key: str | None = None,
        timeout_seconds: int = 10,
        cache_ttl_minutes: int = 30,
    ):
        self.airnow_api_key = airnow_api_key
        self.openaq_api_key = openaq_api_key
        self.timeout_seconds = timeout_seconds
        self.cache_ttl_minutes = cache_ttl_minutes
        self._cache: dict[str, tuple] = {}

        logger.info("Initialized Air Quality service")

    async def get_current_aqi(
        self,
        zip_code: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> AirQualityReading | None:
        """
        Get current air quality for a location.

        Args:
            zip_code: US zip code
            latitude: Latitude coordinate
            longitude: Longitude coordinate

        Returns:
            AirQualityReading or None
        """
        location_key = zip_code or f"{latitude},{longitude}"
        cache_key = f"current:{location_key}"

        cached = self._get_cached(cache_key)
        if cached:
            return cast(AirQualityReading | None, cached)

        try:
            if zip_code and self.airnow_api_key:
                result = await self._get_airnow_current(zip_code)
            elif latitude and longitude:
                result = await self._get_openaq_current(latitude, longitude)
            else:
                result = self._get_simulated_reading(location_key)

            if result:
                self._set_cached(cache_key, result)

            return result

        except Exception as e:
            logger.error(f"Failed to get air quality: {e}")
            return cast(AirQualityReading | None, self._get_simulated_reading(location_key))

    async def get_forecast(
        self,
        zip_code: str,
    ) -> list[AirQualityForecast]:
        """
        Get air quality forecast for a location.

        Args:
            zip_code: US zip code

        Returns:
            List of AirQualityForecast objects
        """
        cache_key = f"forecast:{zip_code}"

        cached = self._get_cached(cache_key)
        if cached:
            return cast(list[AirQualityForecast], cached)

        try:
            if self.airnow_api_key:
                result = await self._get_airnow_forecast(zip_code)
            else:
                result = self._get_simulated_forecast()

            self._set_cached(cache_key, result)
            return result

        except Exception as e:
            logger.error(f"Failed to get air quality forecast: {e}")
            return self._get_simulated_forecast()

    def get_health_guidance(self, aqi: int) -> dict[str, str]:
        """
        Get health guidance for an AQI value.

        Args:
            aqi: Air Quality Index value

        Returns:
            Dict with health guidance
        """
        for (low, high), guidance in self.AQI_CATEGORIES.items():
            if low <= aqi <= high:
                return guidance

        # Above 500
        return self.AQI_CATEGORIES[(301, 500)]

    def get_pediatric_guidance(self, aqi: int) -> dict[str, Any]:
        """
        Get pediatric-specific guidance for an AQI value.

        Args:
            aqi: Air Quality Index value

        Returns:
            Dict with pediatric guidance
        """
        base = self.get_health_guidance(aqi)

        pediatric = {
            **base,
            "pediatric_risk": self._get_pediatric_risk_level(aqi),
            "outdoor_activity": self._get_outdoor_activity_guidance(aqi),
            "symptoms_to_watch": self._get_symptoms_to_watch(aqi),
        }

        return pediatric

    async def _get_airnow_current(self, zip_code: str) -> AirQualityReading | None:
        """Get current AQI from AirNow API."""
        params = {
            "format": "application/json",
            "zipCode": zip_code,
            "distance": 25,
            "API_KEY": self.airnow_api_key,
        }

        url = f"{self.AIRNOW_BASE_URL}/observation/zipCode/current?{urlencode(params)}"

        response = await self._make_request(url)

        if response and len(response) > 0:
            data = response[0]
            return AirQualityReading(
                aqi=data.get("AQI", 0),
                category=data.get("Category", {}).get("Name", "Unknown"),
                pollutant=data.get("ParameterName", "PM2.5"),
                value=data.get("AQI", 0),
                unit="AQI",
                location=f"{data.get('ReportingArea', '')}, {data.get('StateCode', '')}",
                timestamp=datetime.now(__import__("datetime").timezone.utc),
                source="AirNow",
            )

        return None

    async def _get_airnow_forecast(self, zip_code: str) -> list[AirQualityForecast]:
        """Get forecast from AirNow API."""
        params = {
            "format": "application/json",
            "zipCode": zip_code,
            "distance": 25,
            "API_KEY": self.airnow_api_key,
        }

        url = f"{self.AIRNOW_BASE_URL}/forecast/zipCode?{urlencode(params)}"

        response = await self._make_request(url)

        forecasts = []
        if response:
            for data in response:
                forecasts.append(
                    AirQualityForecast(
                        date=data.get("DateForecast", ""),
                        aqi=data.get("AQI", 0),
                        category=data.get("Category", {}).get("Name", "Unknown"),
                        pollutant=data.get("ParameterName", "PM2.5"),
                        discussion=data.get("Discussion"),
                    )
                )

        return forecasts

    async def _get_openaq_current(
        self,
        latitude: float,
        longitude: float,
    ) -> AirQualityReading | None:
        """Get current readings from OpenAQ API."""
        params = {
            "coordinates": f"{latitude},{longitude}",
            "radius": 25000,  # 25km
            "limit": 1,
            "order_by": "datetime",
            "sort": "desc",
        }

        headers = {}
        if self.openaq_api_key:
            headers["X-API-Key"] = self.openaq_api_key

        url = f"{self.OPENAQ_BASE_URL}/latest?{urlencode(params)}"

        response = await self._make_request(url, headers)

        if response and response.get("results"):
            data = response["results"][0]
            measurements = data.get("measurements", [{}])
            pm25 = next((m for m in measurements if m.get("parameter") == "pm25"), measurements[0])

            # Convert PM2.5 to AQI
            aqi = self._pm25_to_aqi(pm25.get("value", 0))

            return AirQualityReading(
                aqi=aqi,
                category=self.get_health_guidance(aqi)["category"],
                pollutant="PM2.5",
                value=pm25.get("value", 0),
                unit=pm25.get("unit", "µg/m³"),
                location=data.get("location", ""),
                timestamp=datetime.now(__import__("datetime").timezone.utc),
                source="OpenAQ",
            )

        return None

    async def _make_request(
        self,
        url: str,
        headers: dict[str, str] | None = None,
    ) -> Any | None:
        """Make HTTP request."""
        # In production, would use aiohttp
        await asyncio.sleep(0.1)
        return None

    def _pm25_to_aqi(self, pm25: float) -> int:
        """Convert PM2.5 concentration to AQI."""
        # EPA breakpoints for PM2.5 (24-hour)
        breakpoints = [
            (0.0, 12.0, 0, 50),
            (12.1, 35.4, 51, 100),
            (35.5, 55.4, 101, 150),
            (55.5, 150.4, 151, 200),
            (150.5, 250.4, 201, 300),
            (250.5, 350.4, 301, 400),
            (350.5, 500.4, 401, 500),
        ]

        for c_low, c_high, i_low, i_high in breakpoints:
            if c_low <= pm25 <= c_high:
                aqi = ((i_high - i_low) / (c_high - c_low)) * (pm25 - c_low) + i_low
                return int(round(aqi))

        return 500 if pm25 > 500 else 0

    def _get_simulated_reading(self, location: str) -> AirQualityReading:
        """Get simulated air quality reading for testing."""
        # Simulate moderate air quality
        return AirQualityReading(
            aqi=65,
            category="Moderate",
            pollutant="PM2.5",
            value=18.5,
            unit="µg/m³",
            location=location,
            timestamp=datetime.now(__import__("datetime").timezone.utc),
            source="Simulated",
        )

    def _get_simulated_forecast(self) -> list[AirQualityForecast]:
        """Get simulated forecast for testing."""
        today = datetime.now(__import__("datetime").timezone.utc)
        return [
            AirQualityForecast(
                date=(today + timedelta(days=i)).strftime("%Y-%m-%d"),
                aqi=50 + (i * 10),
                category="Good" if i == 0 else "Moderate",
                pollutant="PM2.5",
                discussion=None,
            )
            for i in range(3)
        ]

    def _get_pediatric_risk_level(self, aqi: int) -> str:
        """Get pediatric risk level for AQI."""
        if aqi <= 50:
            return "low"
        elif aqi <= 100:
            return "low-moderate"
        elif aqi <= 150:
            return "moderate"
        elif aqi <= 200:
            return "high"
        else:
            return "very-high"

    def _get_outdoor_activity_guidance(self, aqi: int) -> str:
        """Get outdoor activity guidance for children."""
        if aqi <= 50:
            return "All outdoor activities are safe"
        elif aqi <= 100:
            return "Most outdoor activities are safe; consider reducing very strenuous activity"
        elif aqi <= 150:
            return "Reduce prolonged outdoor exertion; take more breaks"
        elif aqi <= 200:
            return "Avoid prolonged outdoor exertion; move activities indoors"
        else:
            return "All outdoor activities should be avoided"

    def _get_symptoms_to_watch(self, aqi: int) -> list[str]:
        """Get symptoms to watch for based on AQI."""
        symptoms = []

        if aqi > 100:
            symptoms.extend(["Coughing", "Throat irritation"])
        if aqi > 150:
            symptoms.extend(["Difficulty breathing", "Wheezing", "Chest tightness"])
        if aqi > 200:
            symptoms.extend(["Aggravated asthma", "Eye irritation", "Headache"])

        return symptoms

    def _get_cached(self, key: str) -> Any | None:
        """Get cached result if not expired."""
        if key in self._cache:
            result, timestamp = self._cache[key]
            if datetime.now(__import__("datetime").timezone.utc) - timestamp < timedelta(
                minutes=self.cache_ttl_minutes
            ):
                return result
            del self._cache[key]
        return None

    def _set_cached(self, key: str, value: Any) -> None:
        """Set cached result."""
        self._cache[key] = (value, datetime.now(__import__("datetime").timezone.utc))
