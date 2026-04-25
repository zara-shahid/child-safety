"""
EPCID Environment Routes

Environmental data endpoints (air quality, weather).
With Redis caching for improved performance.
"""

from datetime import datetime
from typing import Any, cast

from fastapi import APIRouter, Depends, Query

from ...api.dependencies import get_optional_user
from ...api.schemas import (
    AirQualityResponse,
    EnvironmentResponse,
    LocationRequest,
    WeatherResponse,
)
from ...services.air_quality_service import AirQualityService
from ...services.cache_service import get_cache
from ...services.weather_service import WeatherService

router = APIRouter()


# Initialize services
air_quality_service = AirQualityService()
weather_service = WeatherService()
cache = get_cache()


def get_aqi_category(aqi: int) -> str:
    """Get AQI category from value."""
    if aqi <= 50:
        return "Good"
    elif aqi <= 100:
        return "Moderate"
    elif aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    elif aqi <= 200:
        return "Unhealthy"
    elif aqi <= 300:
        return "Very Unhealthy"
    else:
        return "Hazardous"


def get_aqi_health_implications(aqi: int) -> str:
    """Get health implications from AQI."""
    if aqi <= 50:
        return "Air quality is satisfactory, and air pollution poses little or no risk."
    elif aqi <= 100:
        return "Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution."
    elif aqi <= 150:
        return "Members of sensitive groups may experience health effects. The general public is less likely to be affected."
    elif aqi <= 200:
        return "Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects."
    elif aqi <= 300:
        return "Health alert: The risk of health effects is increased for everyone."
    else:
        return "Health warning of emergency conditions: everyone is more likely to be affected."


def get_aqi_pediatric_advisory(aqi: int) -> str | None:
    """Get pediatric-specific advisory from AQI."""
    if aqi <= 50:
        return None
    elif aqi <= 100:
        return "Children with asthma should follow their asthma action plans and keep quick-relief medicine handy."
    elif aqi <= 150:
        return "Children with respiratory conditions should limit prolonged outdoor exertion. All children should take more breaks during outdoor activities."
    elif aqi <= 200:
        return "All children should limit prolonged outdoor exertion. Children with respiratory conditions should avoid outdoor activities."
    else:
        return "Keep children indoors with windows closed. Use air purifiers if available. Avoid all outdoor activities."


def get_aqi_recommendation(aqi: int) -> str:
    """Get activity recommendation from AQI."""
    if aqi <= 50:
        return "It's a great day to be active outside!"
    elif aqi <= 100:
        return "Outdoor activities are fine for most children."
    elif aqi <= 150:
        return "Consider reducing prolonged or intense outdoor activities."
    elif aqi <= 200:
        return "Reduce prolonged or intense outdoor activities. Take more breaks."
    else:
        return "Avoid outdoor activities. Keep children indoors."


@router.get(
    "/air-quality",
    response_model=AirQualityResponse,
    summary="Get air quality data",
    description="Get current air quality data for a location. Cached for 30 minutes.",
)
async def get_air_quality(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    current_user: dict[str, Any] | None = Depends(get_optional_user),
) -> AirQualityResponse:
    """
    Get air quality data for a location.

    Returns AQI, pollutant levels, and health recommendations.
    Results are cached in Redis for 30 minutes.
    """
    # Check Redis cache first
    cache_key = f"airquality:{latitude:.2f},{longitude:.2f}"
    cached = cache.get(cache_key)
    if cached:
        return AirQualityResponse(**cached)

    try:
        # Get data from service
        data = await air_quality_service.get_current_aqi(latitude=latitude, longitude=longitude)

        aqi = data.aqi if data else 50

        response_data = {
            "aqi": aqi,
            "category": get_aqi_category(aqi),
            "dominant_pollutant": data.pollutant if data else "pm25",
            "pollutants": {
                "pm25": (
                    getattr(data, "value", 15.0) if data and data.pollutant == "PM2.5" else 15.0
                ),
                "pm10": 25.0,
                "o3": 30.0,
                "no2": 10.0,
            },
            "health_implications": get_aqi_health_implications(aqi),
            "recommendation": get_aqi_recommendation(aqi),
            "pediatric_advisory": get_aqi_pediatric_advisory(aqi),
            "data_timestamp": datetime.now(__import__("datetime").timezone.utc).isoformat(),
            "location": f"{latitude:.4f}, {longitude:.4f}",
        }

        # Cache for 30 minutes
        cache.set(cache_key, response_data, ttl=1800)

        return AirQualityResponse(**cast(dict[str, Any], response_data))

    except Exception:
        # Return default data on error
        return AirQualityResponse(
            aqi=50,
            category="Good",
            dominant_pollutant="unknown",
            pollutants={},
            health_implications="Unable to retrieve air quality data.",
            recommendation="Check local air quality sources.",
            pediatric_advisory=None,
            data_timestamp=datetime.now(__import__("datetime").timezone.utc),
            location=f"{latitude:.4f}, {longitude:.4f}",
        )


@router.get(
    "/weather",
    response_model=WeatherResponse,
    summary="Get weather data",
    description="Get current weather data for a location. Cached for 15 minutes.",
)
async def get_weather(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    current_user: dict[str, Any] | None = Depends(get_optional_user),
) -> WeatherResponse:
    """
    Get weather data for a location.

    Returns temperature, conditions, and health considerations.
    Results are cached in Redis for 15 minutes.
    """
    # Check Redis cache first
    cache_key = f"weather:{latitude:.2f},{longitude:.2f}"
    cached = cache.get(cache_key)
    if cached:
        return WeatherResponse(**cached)

    try:
        data = await weather_service.get_current_weather(latitude=latitude, longitude=longitude)

        temp = getattr(data, "temperature_f", 72.0) if data else 72.0
        humidity = getattr(data, "humidity_percent", 50) if data else 50

        # Generate pediatric considerations
        considerations = []

        if temp > 90:
            considerations.append(
                "High heat: Ensure children stay hydrated and limit outdoor activity during peak hours."
            )
        elif temp > 85:
            considerations.append(
                "Warm weather: Encourage frequent water breaks during outdoor play."
            )
        elif temp < 32:
            considerations.append(
                "Freezing temperatures: Dress children in layers and limit prolonged exposure."
            )
        elif temp < 50:
            considerations.append(
                "Cool weather: Ensure children are dressed appropriately for outdoor activities."
            )

        if humidity > 70:
            considerations.append(
                "High humidity: Heat feels more intense. Watch for signs of heat exhaustion."
            )
        elif humidity < 30:
            considerations.append(
                "Low humidity: Dry air may irritate airways. Consider a humidifier indoors."
            )

        uv_index = getattr(data, "uv_index", None) if data else None
        if uv_index and uv_index > 6:
            considerations.append(
                "High UV index: Apply sunscreen and limit sun exposure between 10am-4pm."
            )

        if not considerations:
            considerations.append("Weather conditions are favorable for outdoor activities.")

        response_data = {
            "temperature": temp,
            "feels_like": getattr(data, "feels_like_f", temp) if data else temp,
            "humidity": humidity,
            "conditions": getattr(data, "condition", "Clear") if data else "Clear",
            "wind_speed": getattr(data, "wind_speed_mph", 5.0) if data else 5.0,
            "uv_index": uv_index,
            "alerts": [],
            "pediatric_considerations": considerations,
            "data_timestamp": datetime.now(__import__("datetime").timezone.utc).isoformat(),
            "location": f"{latitude:.4f}, {longitude:.4f}",
        }

        # Cache for 15 minutes
        cache.set(cache_key, response_data, ttl=900)

        return WeatherResponse(**cast(dict[str, Any], response_data))

    except Exception:
        return WeatherResponse(
            temperature=72.0,
            feels_like=72.0,
            humidity=50,
            conditions="Unknown",
            wind_speed=0.0,
            uv_index=None,
            alerts=[],
            pediatric_considerations=["Unable to retrieve weather data."],
            data_timestamp=datetime.now(__import__("datetime").timezone.utc),
            location=f"{latitude:.4f}, {longitude:.4f}",
        )


@router.post(
    "/",
    response_model=EnvironmentResponse,
    summary="Get full environmental data",
    description="Get combined air quality and weather data.",
)
async def get_environment(
    location: LocationRequest,
    current_user: dict[str, Any] | None = Depends(get_optional_user),
) -> EnvironmentResponse:
    """
    Get comprehensive environmental data for a location.

    Combines air quality and weather data with health recommendations.
    """
    # Get both data sources
    air_quality = await get_air_quality(
        latitude=location.latitude,
        longitude=location.longitude,
    )

    weather = await get_weather(
        latitude=location.latitude,
        longitude=location.longitude,
    )

    # Generate combined health impact summary
    impacts = []

    if air_quality.aqi > 100:
        impacts.append(f"Air quality is {air_quality.category.lower()}.")

    if weather.temperature > 90:
        impacts.append("High temperatures may increase health risks.")
    elif weather.temperature < 32:
        impacts.append("Freezing temperatures require precautions.")

    if not impacts:
        summary = "Environmental conditions are favorable for children's outdoor activities."
    else:
        summary = " ".join(impacts) + " Consider the recommendations below."

    # Combine recommendations
    recommendations = []

    if air_quality.pediatric_advisory:
        recommendations.append(air_quality.pediatric_advisory)

    recommendations.extend(weather.pediatric_considerations)

    return EnvironmentResponse(
        air_quality=air_quality,
        weather=weather,
        health_impact_summary=summary,
        recommendations=recommendations,
    )


@router.get(
    "/health-risks",
    response_model=dict,
    summary="Get environmental health risks",
    description="Get environmental health risks for symptoms.",
)
async def get_health_risks(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    symptoms: str | None = Query(None, description="Comma-separated symptoms"),
) -> dict[str, Any]:
    """
    Analyze environmental factors that may be contributing to symptoms.
    """
    env_data = await get_environment(LocationRequest(latitude=latitude, longitude=longitude))

    correlations = []

    symptom_list = symptoms.split(",") if symptoms else []

    for symptom in symptom_list:
        symptom = symptom.strip().lower()

        if symptom in ["cough", "wheeze", "breathing", "asthma"]:
            if env_data.air_quality.aqi > 100:
                correlations.append(
                    {
                        "symptom": symptom,
                        "factor": "air_quality",
                        "correlation": "high",
                        "explanation": f"Current AQI of {env_data.air_quality.aqi} may be contributing to respiratory symptoms.",
                        "recommendation": env_data.air_quality.pediatric_advisory,
                    }
                )

        if symptom in ["heat", "dehydration", "fatigue"]:
            if env_data.weather.temperature > 85:
                correlations.append(
                    {
                        "symptom": symptom,
                        "factor": "temperature",
                        "correlation": "moderate",
                        "explanation": f"Current temperature of {env_data.weather.temperature}°F may be contributing.",
                        "recommendation": "Stay hydrated and limit outdoor activity.",
                    }
                )

        if symptom in ["headache", "allergies", "congestion"]:
            if env_data.air_quality.aqi > 50:
                correlations.append(
                    {
                        "symptom": symptom,
                        "factor": "air_quality",
                        "correlation": "moderate",
                        "explanation": "Air quality may be triggering allergic or sensitivity symptoms.",
                        "recommendation": "Consider staying indoors during peak pollution hours.",
                    }
                )

    return {
        "location": f"{latitude}, {longitude}",
        "environmental_summary": {
            "aqi": env_data.air_quality.aqi,
            "temperature": env_data.weather.temperature,
            "conditions": env_data.weather.conditions,
        },
        "symptom_correlations": correlations,
        "general_recommendations": env_data.recommendations,
    }
