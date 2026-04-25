"""
EPCID Weather Service

Integration with weather APIs:
- NOAA Climate Data Online (CDO)
- OpenWeatherMap

Provides:
- Current weather conditions
- Temperature and humidity
- Weather alerts
- Forecast data
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, cast
from urllib.parse import urlencode

logger = logging.getLogger("epcid.services.weather")


@dataclass
class WeatherConditions:
    """Current weather conditions."""

    temperature_f: float
    feels_like_f: float
    humidity_percent: int
    wind_speed_mph: float
    condition: str
    description: str
    uv_index: int | None
    visibility_miles: float | None
    pressure_hpa: float | None
    location: str
    timestamp: datetime
    source: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "temperature_f": self.temperature_f,
            "feels_like_f": self.feels_like_f,
            "humidity_percent": self.humidity_percent,
            "wind_speed_mph": self.wind_speed_mph,
            "condition": self.condition,
            "description": self.description,
            "uv_index": self.uv_index,
            "location": self.location,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class WeatherAlert:
    """A weather alert/warning."""

    event: str
    severity: str
    headline: str
    description: str
    start: datetime
    end: datetime | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "event": self.event,
            "severity": self.severity,
            "headline": self.headline,
            "start": self.start.isoformat(),
            "end": self.end.isoformat() if self.end else None,
        }


@dataclass
class WeatherForecast:
    """Weather forecast for a specific time period."""

    date: str
    high_f: float
    low_f: float
    condition: str
    precipitation_chance: int
    humidity_percent: int


class WeatherService:
    """
    Service for weather data from NOAA and OpenWeatherMap.

    Provides current conditions, forecasts, and weather alerts
    with health implications for children.
    """

    NOAA_BASE_URL = "https://api.weather.gov"
    OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5"

    # Temperature thresholds for health guidance
    TEMP_THRESHOLDS = {
        "extreme_cold": {"f": 32, "message": "Risk of hypothermia. Limit outdoor exposure."},
        "cold": {"f": 45, "message": "Dress warmly. Watch for shivering."},
        "comfortable_low": {"f": 60, "message": "Comfortable for outdoor activities."},
        "comfortable_high": {"f": 80, "message": "Comfortable for outdoor activities."},
        "hot": {"f": 85, "message": "Stay hydrated. Limit strenuous activity."},
        "very_hot": {"f": 90, "message": "Heat caution. Avoid prolonged outdoor activity."},
        "extreme_hot": {"f": 100, "message": "Dangerous heat. Keep children indoors."},
    }

    def __init__(
        self,
        noaa_api_key: str | None = None,
        openweather_api_key: str | None = None,
        timeout_seconds: int = 10,
        cache_ttl_minutes: int = 15,
    ):
        self.noaa_api_key = noaa_api_key
        self.openweather_api_key = openweather_api_key
        self.timeout_seconds = timeout_seconds
        self.cache_ttl_minutes = cache_ttl_minutes
        self._cache: dict[str, tuple] = {}

        logger.info("Initialized Weather service")

    async def get_current_weather(
        self,
        zip_code: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> WeatherConditions | None:
        """
        Get current weather conditions.

        Args:
            zip_code: US zip code
            latitude: Latitude coordinate
            longitude: Longitude coordinate

        Returns:
            WeatherConditions or None
        """
        location_key = zip_code or f"{latitude},{longitude}"
        cache_key = f"current:{location_key}"

        cached = self._get_cached(cache_key)
        if cached:
            return cast(WeatherConditions | None, cached)

        try:
            if self.openweather_api_key:
                result = await self._get_openweather_current(zip_code, latitude, longitude)
            else:
                result = self._get_simulated_weather(location_key)

            if result:
                self._set_cached(cache_key, result)

            return result

        except Exception as e:
            logger.error(f"Failed to get weather: {e}")
            return self._get_simulated_weather(location_key)

    async def get_forecast(
        self,
        zip_code: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        days: int = 5,
    ) -> list[WeatherForecast]:
        """
        Get weather forecast.

        Args:
            zip_code: US zip code
            latitude: Latitude coordinate
            longitude: Longitude coordinate
            days: Number of days to forecast

        Returns:
            List of WeatherForecast objects
        """
        location_key = zip_code or f"{latitude},{longitude}"
        cache_key = f"forecast:{location_key}"

        cached = self._get_cached(cache_key)
        if cached:
            return cast(list[WeatherForecast], cached)

        try:
            if self.openweather_api_key:
                result = await self._get_openweather_forecast(zip_code, latitude, longitude)
            else:
                result = self._get_simulated_forecast()

            self._set_cached(cache_key, result)
            return result[:days]

        except Exception as e:
            logger.error(f"Failed to get forecast: {e}")
            return self._get_simulated_forecast()[:days]

    async def get_alerts(
        self,
        latitude: float,
        longitude: float,
    ) -> list[WeatherAlert]:
        """
        Get active weather alerts for a location.

        Args:
            latitude: Latitude coordinate
            longitude: Longitude coordinate

        Returns:
            List of WeatherAlert objects
        """
        cache_key = f"alerts:{latitude},{longitude}"

        cached = self._get_cached(cache_key)
        if cached:
            return cast(list[WeatherAlert], cached)

        try:
            result = await self._get_noaa_alerts(latitude, longitude)
            self._set_cached(cache_key, result)
            return result

        except Exception as e:
            logger.error(f"Failed to get weather alerts: {e}")
            return []

    def get_health_guidance(
        self,
        weather: WeatherConditions,
    ) -> dict[str, Any]:
        """
        Get health guidance based on weather conditions.

        Args:
            weather: Current weather conditions

        Returns:
            Dict with health guidance
        """
        recs: list[str] = []
        symps: list[str] = []
        guidance: dict[str, Any] = {
            "temperature_guidance": self._get_temperature_guidance(weather.temperature_f),
            "humidity_guidance": self._get_humidity_guidance(weather.humidity_percent),
            "overall_risk": "low",
            "recommendations": recs,
            "symptoms_to_watch": symps,
        }

        # Temperature-based recommendations
        if weather.temperature_f >= 90:
            guidance["overall_risk"] = "high"
            recs.extend(
                [
                    "Keep children indoors during peak heat (10am-4pm)",
                    "Ensure frequent hydration",
                    "Watch for signs of heat exhaustion",
                ]
            )
            symps.extend(
                [
                    "Excessive sweating or lack of sweating",
                    "Headache",
                    "Dizziness",
                    "Nausea",
                ]
            )
        elif weather.temperature_f >= 85:
            guidance["overall_risk"] = "moderate"
            recs.extend(
                [
                    "Limit strenuous outdoor activity",
                    "Encourage water breaks every 15-20 minutes",
                ]
            )
        elif weather.temperature_f <= 32:
            guidance["overall_risk"] = "high"
            recs.extend(
                [
                    "Dress in warm layers",
                    "Limit outdoor exposure",
                    "Watch for signs of hypothermia",
                ]
            )
            symps.extend(
                [
                    "Shivering",
                    "Confusion",
                    "Slurred speech",
                ]
            )

        # Humidity considerations
        if weather.humidity_percent > 80:
            recs.append("High humidity - take extra breaks during physical activity")
        elif weather.humidity_percent < 30:
            recs.append(
                "Low humidity - ensure good hydration and consider using a humidifier indoors"
            )

        # UV considerations
        if weather.uv_index and weather.uv_index >= 8:
            recs.extend(
                [
                    f"High UV index ({weather.uv_index}) - apply sunscreen",
                    "Wear protective clothing and hat",
                    "Seek shade during midday hours",
                ]
            )

        return guidance

    def _get_temperature_guidance(self, temp_f: float) -> dict[str, Any]:
        """Get guidance for a specific temperature."""
        if temp_f >= 100:
            return {
                "category": "extreme_hot",
                "risk": "high",
                "message": self.TEMP_THRESHOLDS["extreme_hot"]["message"],
            }
        elif temp_f >= 90:
            return {
                "category": "very_hot",
                "risk": "moderate-high",
                "message": self.TEMP_THRESHOLDS["very_hot"]["message"],
            }
        elif temp_f >= 85:
            return {
                "category": "hot",
                "risk": "moderate",
                "message": self.TEMP_THRESHOLDS["hot"]["message"],
            }
        elif temp_f >= 60:
            return {
                "category": "comfortable",
                "risk": "low",
                "message": self.TEMP_THRESHOLDS["comfortable_high"]["message"],
            }
        elif temp_f >= 45:
            return {
                "category": "cool",
                "risk": "low",
                "message": self.TEMP_THRESHOLDS["cold"]["message"],
            }
        elif temp_f >= 32:
            return {
                "category": "cold",
                "risk": "moderate",
                "message": self.TEMP_THRESHOLDS["cold"]["message"],
            }
        else:
            return {
                "category": "extreme_cold",
                "risk": "high",
                "message": self.TEMP_THRESHOLDS["extreme_cold"]["message"],
            }

    def _get_humidity_guidance(self, humidity: int) -> dict[str, Any]:
        """Get guidance for humidity level."""
        if humidity > 80:
            return {
                "category": "high",
                "message": "High humidity may make heat feel worse and affect breathing.",
            }
        elif humidity > 60:
            return {
                "category": "moderate",
                "message": "Comfortable humidity levels.",
            }
        elif humidity > 30:
            return {
                "category": "comfortable",
                "message": "Optimal humidity range.",
            }
        else:
            return {
                "category": "low",
                "message": "Low humidity may cause dry skin and respiratory irritation.",
            }

    async def _get_openweather_current(
        self,
        zip_code: str | None,
        latitude: float | None,
        longitude: float | None,
    ) -> WeatherConditions | None:
        """Get current weather from OpenWeatherMap."""
        params: dict[str, Any] = {
            "appid": self.openweather_api_key,
            "units": "imperial",
        }

        if zip_code:
            params["zip"] = f"{zip_code},us"
        elif latitude and longitude:
            params["lat"] = latitude
            params["lon"] = longitude
        else:
            return None

        url = f"{self.OPENWEATHER_BASE_URL}/weather?{urlencode(params)}"

        response = await self._make_request(url)

        if response:
            main = response.get("main", {})
            weather = response.get("weather", [{}])[0]
            wind = response.get("wind", {})

            return WeatherConditions(
                temperature_f=main.get("temp", 0),
                feels_like_f=main.get("feels_like", 0),
                humidity_percent=main.get("humidity", 0),
                wind_speed_mph=wind.get("speed", 0),
                condition=weather.get("main", "Unknown"),
                description=weather.get("description", ""),
                uv_index=None,  # Requires separate API call
                visibility_miles=response.get("visibility", 0) / 1609,
                pressure_hpa=main.get("pressure"),
                location=response.get("name", ""),
                timestamp=datetime.now(__import__("datetime").timezone.utc),
                source="OpenWeatherMap",
            )

        return None

    async def _get_openweather_forecast(
        self,
        zip_code: str | None,
        latitude: float | None,
        longitude: float | None,
    ) -> list[WeatherForecast]:
        """Get forecast from OpenWeatherMap."""
        params: dict[str, Any] = {
            "appid": self.openweather_api_key,
            "units": "imperial",
        }

        if zip_code:
            params["zip"] = f"{zip_code},us"
        elif latitude and longitude:
            params["lat"] = latitude
            params["lon"] = longitude
        else:
            return []

        url = f"{self.OPENWEATHER_BASE_URL}/forecast?{urlencode(params)}"

        response = await self._make_request(url)

        if response and response.get("list"):
            # Group by day
            daily: dict[str, dict[str, list[Any]]] = {}
            for item in response["list"]:
                date = item["dt_txt"].split()[0]
                if date not in daily:
                    daily[date] = {
                        "temps": [],
                        "humidity": [],
                        "conditions": [],
                        "pop": [],
                    }
                daily[date]["temps"].append(item["main"]["temp"])
                daily[date]["humidity"].append(item["main"]["humidity"])
                daily[date]["conditions"].append(item["weather"][0]["main"])
                daily[date]["pop"].append(item.get("pop", 0) * 100)

            forecasts = []
            for date, data in list(daily.items())[:7]:
                forecasts.append(
                    WeatherForecast(
                        date=date,
                        high_f=max(data["temps"]),
                        low_f=min(data["temps"]),
                        condition=max(set(data["conditions"]), key=data["conditions"].count),
                        precipitation_chance=int(max(data["pop"])),
                        humidity_percent=int(sum(data["humidity"]) / len(data["humidity"])),
                    )
                )

            return forecasts

        return []

    async def _get_noaa_alerts(
        self,
        latitude: float,
        longitude: float,
    ) -> list[WeatherAlert]:
        """Get weather alerts from NOAA."""
        url = f"{self.NOAA_BASE_URL}/alerts/active?point={latitude},{longitude}"

        response = await self._make_request(url)

        alerts = []
        if response and response.get("features"):
            for feature in response["features"]:
                props = feature.get("properties", {})
                alerts.append(
                    WeatherAlert(
                        event=props.get("event", "Unknown"),
                        severity=props.get("severity", "Unknown"),
                        headline=props.get("headline", ""),
                        description=props.get("description", ""),
                        start=datetime.fromisoformat(
                            props.get(
                                "onset",
                                datetime.now(__import__("datetime").timezone.utc).isoformat(),
                            ).replace("Z", "+00:00")
                        ),
                        end=(
                            datetime.fromisoformat(props.get("ends").replace("Z", "+00:00"))
                            if props.get("ends")
                            else None
                        ),
                    )
                )

        return alerts

    async def _make_request(self, url: str) -> dict[str, Any] | None:
        """Make HTTP request."""
        # In production, would use aiohttp
        await asyncio.sleep(0.1)
        return None

    def _get_simulated_weather(self, location: str) -> WeatherConditions:
        """Get simulated weather for testing."""
        return WeatherConditions(
            temperature_f=72,
            feels_like_f=74,
            humidity_percent=55,
            wind_speed_mph=8,
            condition="Partly Cloudy",
            description="partly cloudy with a chance of sunshine",
            uv_index=6,
            visibility_miles=10,
            pressure_hpa=1015,
            location=location,
            timestamp=datetime.now(__import__("datetime").timezone.utc),
            source="Simulated",
        )

    def _get_simulated_forecast(self) -> list[WeatherForecast]:
        """Get simulated forecast for testing."""
        today = datetime.now(__import__("datetime").timezone.utc)
        return [
            WeatherForecast(
                date=(today + timedelta(days=i)).strftime("%Y-%m-%d"),
                high_f=72 + (i * 2),
                low_f=58 + i,
                condition=["Sunny", "Partly Cloudy", "Cloudy", "Sunny", "Partly Cloudy"][i % 5],
                precipitation_chance=10 * i,
                humidity_percent=50 + (i * 5),
            )
            for i in range(5)
        ]

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
