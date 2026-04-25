"""
EPCID CDC Data Service

Integration with CDC APIs for:
- Disease outbreak surveillance (flu, RSV, COVID)
- Vaccination schedules
- Growth charts / percentiles
- Pediatric mortality data

APIs Used:
- CDC FluView: https://www.cdc.gov/flu/weekly/fluviewinteractive.htm
- CDC WONDER: https://wonder.cdc.gov/
- CDC Vaccination Schedules: https://www.cdc.gov/vaccines/schedules/
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, cast

logger = logging.getLogger("epcid.services.cdc")


class DiseaseType(str, Enum):
    """Trackable disease types."""

    INFLUENZA = "influenza"
    RSV = "rsv"
    COVID = "covid"
    STREP = "strep"
    ENTEROVIRUS = "enterovirus"


class ActivityLevel(str, Enum):
    """CDC activity levels."""

    MINIMAL = "minimal"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


@dataclass
class DiseaseActivity:
    """Disease activity in a region."""

    disease: DiseaseType
    region: str
    state: str
    activity_level: ActivityLevel
    trend: str  # increasing, stable, decreasing
    week_number: int
    year: int
    pediatric_impact: str
    recommendation: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "disease": self.disease.value,
            "region": self.region,
            "state": self.state,
            "activity_level": self.activity_level.value,
            "trend": self.trend,
            "week": f"{self.year}-W{self.week_number}",
            "pediatric_impact": self.pediatric_impact,
            "recommendation": self.recommendation,
        }


@dataclass
class VaccinationSchedule:
    """Recommended vaccination."""

    vaccine_name: str
    disease: str
    recommended_age: str
    dose_number: int
    total_doses: int
    catch_up_age: str | None
    notes: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "vaccine_name": self.vaccine_name,
            "disease": self.disease,
            "recommended_age": self.recommended_age,
            "dose": f"{self.dose_number} of {self.total_doses}",
            "catch_up_age": self.catch_up_age,
            "notes": self.notes,
        }


@dataclass
class GrowthPercentile:
    """Growth percentile data."""

    age_months: int
    sex: str
    measurement_type: str  # weight, height, head_circumference, bmi
    p5: float
    p10: float
    p25: float
    p50: float
    p75: float
    p90: float
    p95: float


class CDCService:
    """
    Service for CDC data integration.

    Provides disease surveillance, vaccination schedules,
    and pediatric growth reference data.
    """

    FLUVIEW_BASE_URL = "https://www.cdc.gov/flu/weekly/flureport.xml"

    def __init__(
        self,
        cache_ttl_hours: int = 6,
    ):
        self.cache_ttl_hours = cache_ttl_hours
        self._cache: dict[str, tuple] = {}

        # Pre-load reference data
        self._vaccination_schedule = self._load_vaccination_schedule()
        self._growth_charts = self._load_growth_charts()

        logger.info("Initialized CDC service")

    async def get_disease_activity(
        self,
        state: str,
        diseases: list[DiseaseType] | None = None,
    ) -> list[DiseaseActivity]:
        """
        Get current disease activity for a state.

        Args:
            state: Two-letter state code (e.g., "CA")
            diseases: List of diseases to check (default: all)

        Returns:
            List of DiseaseActivity objects
        """
        cache_key = f"activity:{state}"

        cached = self._get_cached(cache_key)
        if cached:
            return cast(list[DiseaseActivity], cached)

        diseases = diseases or list(DiseaseType)
        activities = []

        # In production, would call actual CDC APIs
        # For now, use curated regional data
        for disease in diseases:
            activity = self._get_regional_activity(state, disease)
            if activity:
                activities.append(activity)

        self._set_cached(cache_key, activities)
        return activities

    async def get_outbreak_alerts(
        self,
        state: str,
        zip_code: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Get active outbreak alerts for a region.

        Args:
            state: Two-letter state code
            zip_code: str | None zip code for local alerts

        Returns:
            List of alert dictionaries
        """
        activities = await self.get_disease_activity(state)

        alerts = []
        for activity in activities:
            if activity.activity_level in [ActivityLevel.HIGH, ActivityLevel.VERY_HIGH]:
                alerts.append(
                    {
                        "type": "outbreak_alert",
                        "disease": activity.disease.value,
                        "severity": (
                            "high" if activity.activity_level == ActivityLevel.HIGH else "critical"
                        ),
                        "title": f"{activity.disease.value.upper()} Activity Alert",
                        "message": f"{activity.disease.value.title()} activity is {activity.activity_level.value.replace('_', ' ')} in {activity.state}. {activity.recommendation}",
                        "pediatric_impact": activity.pediatric_impact,
                        "trend": activity.trend,
                    }
                )

        return alerts

    def get_vaccination_schedule(
        self,
        age_months: int,
        include_catchup: bool = True,
    ) -> list[VaccinationSchedule]:
        """
        Get recommended vaccinations for a child's age.

        Args:
            age_months: Child's age in months
            include_catchup: Include catch-up vaccines

        Returns:
            List of VaccinationSchedule objects
        """
        due_vaccines = []

        for vaccine in self._vaccination_schedule:
            rec_age = self._parse_age_range(vaccine.recommended_age)

            if rec_age[0] <= age_months <= rec_age[1]:
                due_vaccines.append(vaccine)
            elif include_catchup and vaccine.catch_up_age:
                catchup_age = self._parse_age_range(vaccine.catch_up_age)
                if catchup_age[0] <= age_months <= catchup_age[1]:
                    due_vaccines.append(vaccine)

        return due_vaccines

    def get_growth_percentile(
        self,
        age_months: int,
        sex: str,
        measurement_type: str,
        value: float,
    ) -> dict[str, Any]:
        """
        Calculate growth percentile for a measurement.

        Args:
            age_months: Child's age in months
            sex: 'male' or 'female'
            measurement_type: 'weight', 'height', 'head_circumference', 'bmi'
            value: The measured value

        Returns:
            Dict with percentile information
        """
        chart = self._get_growth_chart(age_months, sex, measurement_type)

        if not chart:
            return {
                "percentile": None,
                "status": "unknown",
                "message": "Growth data not available for this age/measurement",
            }

        # Calculate percentile
        percentile = self._interpolate_percentile(chart, value)

        # Determine status
        if percentile < 3:
            status = "below_normal"
            message = "Below 3rd percentile - consult pediatrician"
        elif percentile < 5:
            status = "low"
            message = "Between 3rd and 5th percentile - monitor closely"
        elif percentile <= 95:
            status = "normal"
            message = f"Within normal range ({percentile}th percentile)"
        elif percentile <= 97:
            status = "high"
            message = "Between 95th and 97th percentile - monitor"
        else:
            status = "above_normal"
            message = "Above 97th percentile - consult pediatrician"

        return {
            "percentile": percentile,
            "status": status,
            "message": message,
            "reference": {
                "p5": chart.p5,
                "p50": chart.p50,
                "p95": chart.p95,
            },
        }

    def get_vital_sign_reference(
        self,
        age_months: int,
        vital_type: str,
    ) -> dict[str, Any]:
        """
        Get normal vital sign ranges for age.

        Args:
            age_months: Child's age in months
            vital_type: 'heart_rate', 'respiratory_rate', 'blood_pressure', 'temperature'

        Returns:
            Dict with normal ranges
        """
        # Age-specific vital sign ranges (from pediatric references)
        ranges = self._get_vital_ranges_for_age(age_months)

        if vital_type not in ranges:
            return {"error": f"Unknown vital type: {vital_type}"}

        return {
            "vital_type": vital_type,
            "age_months": age_months,
            "age_group": self._get_age_group(age_months),
            **ranges[vital_type],
        }

    def _get_regional_activity(
        self,
        state: str,
        disease: DiseaseType,
    ) -> DiseaseActivity | None:
        """Get simulated regional disease activity."""
        # Regional data (would come from CDC APIs in production)
        # This simulates typical winter respiratory illness patterns

        current_week = datetime.now().isocalendar()[1]
        is_respiratory_season = current_week >= 40 or current_week <= 15

        activity_data = {
            DiseaseType.INFLUENZA: {
                "activity_level": (
                    ActivityLevel.HIGH if is_respiratory_season else ActivityLevel.LOW
                ),
                "trend": "increasing" if 40 <= current_week <= 52 else "decreasing",
                "pediatric_impact": "Children under 5 at highest risk for complications",
                "recommendation": "Ensure flu vaccination is current. Wash hands frequently.",
            },
            DiseaseType.RSV: {
                "activity_level": (
                    ActivityLevel.MODERATE if is_respiratory_season else ActivityLevel.MINIMAL
                ),
                "trend": "stable",
                "pediatric_impact": "Infants under 6 months at highest risk",
                "recommendation": "Limit exposure to sick contacts. Practice good hygiene.",
            },
            DiseaseType.COVID: {
                "activity_level": ActivityLevel.LOW,
                "trend": "stable",
                "pediatric_impact": "Most children have mild illness",
                "recommendation": "Stay up to date on vaccinations.",
            },
            DiseaseType.STREP: {
                "activity_level": ActivityLevel.MODERATE,
                "trend": "stable",
                "pediatric_impact": "Common in school-age children",
                "recommendation": "Seek testing if child has sore throat and fever.",
            },
            DiseaseType.ENTEROVIRUS: {
                "activity_level": ActivityLevel.LOW,
                "trend": "decreasing",
                "pediatric_impact": "Can cause hand-foot-mouth disease in young children",
                "recommendation": "Practice good hand hygiene. Keep children home if symptomatic.",
            },
        }

        data = activity_data.get(disease)
        if not data:
            return None

        return DiseaseActivity(
            disease=disease,
            region=self._state_to_region(state),
            state=state,
            activity_level=cast(ActivityLevel, data["activity_level"]),
            trend=data["trend"],
            week_number=current_week,
            year=datetime.now().year,
            pediatric_impact=data["pediatric_impact"],
            recommendation=data["recommendation"],
        )

    def _state_to_region(self, state: str) -> str:
        """Convert state to HHS region."""
        regions = {
            "Region 1": ["CT", "ME", "MA", "NH", "RI", "VT"],
            "Region 2": ["NJ", "NY"],
            "Region 3": ["DE", "DC", "MD", "PA", "VA", "WV"],
            "Region 4": ["AL", "FL", "GA", "KY", "MS", "NC", "SC", "TN"],
            "Region 5": ["IL", "IN", "MI", "MN", "OH", "WI"],
            "Region 6": ["AR", "LA", "NM", "OK", "TX"],
            "Region 7": ["IA", "KS", "MO", "NE"],
            "Region 8": ["CO", "MT", "ND", "SD", "UT", "WY"],
            "Region 9": ["AZ", "CA", "HI", "NV"],
            "Region 10": ["AK", "ID", "OR", "WA"],
        }

        for region, states in regions.items():
            if state.upper() in states:
                return region
        return "Unknown"

    def _load_vaccination_schedule(self) -> list[VaccinationSchedule]:
        """Load CDC vaccination schedule."""
        # Based on CDC 2024 schedule
        return [
            # Birth
            VaccinationSchedule(
                "Hepatitis B", "Hepatitis B", "0 months", 1, 3, "0-18 years", "First dose at birth"
            ),
            # 2 months
            VaccinationSchedule(
                "DTaP", "Diphtheria, Tetanus, Pertussis", "2 months", 1, 5, None, ""
            ),
            VaccinationSchedule("Hib", "Haemophilus influenzae type b", "2 months", 1, 4, None, ""),
            VaccinationSchedule("IPV", "Polio", "2 months", 1, 4, None, ""),
            VaccinationSchedule("PCV15/PCV20", "Pneumococcal", "2 months", 1, 4, None, ""),
            VaccinationSchedule(
                "RV", "Rotavirus", "2 months", 1, 3, None, "Must start by 15 weeks"
            ),
            VaccinationSchedule("Hepatitis B", "Hepatitis B", "2 months", 2, 3, None, ""),
            # 4 months
            VaccinationSchedule(
                "DTaP", "Diphtheria, Tetanus, Pertussis", "4 months", 2, 5, None, ""
            ),
            VaccinationSchedule("Hib", "Haemophilus influenzae type b", "4 months", 2, 4, None, ""),
            VaccinationSchedule("IPV", "Polio", "4 months", 2, 4, None, ""),
            VaccinationSchedule("PCV15/PCV20", "Pneumococcal", "4 months", 2, 4, None, ""),
            VaccinationSchedule("RV", "Rotavirus", "4 months", 2, 3, None, ""),
            # 6 months
            VaccinationSchedule(
                "DTaP", "Diphtheria, Tetanus, Pertussis", "6 months", 3, 5, None, ""
            ),
            VaccinationSchedule(
                "Hib", "Haemophilus influenzae type b", "6 months", 3, 4, None, "Depending on brand"
            ),
            VaccinationSchedule("PCV15/PCV20", "Pneumococcal", "6 months", 3, 4, None, ""),
            VaccinationSchedule("RV", "Rotavirus", "6 months", 3, 3, None, "If using RotaTeq"),
            VaccinationSchedule("Hepatitis B", "Hepatitis B", "6-18 months", 3, 3, None, ""),
            VaccinationSchedule("IPV", "Polio", "6-18 months", 3, 4, None, ""),
            VaccinationSchedule(
                "Influenza", "Influenza", "6 months+", 1, 2, None, "Annual; 2 doses first year"
            ),
            # 12-15 months
            VaccinationSchedule(
                "MMR", "Measles, Mumps, Rubella", "12-15 months", 1, 2, "13 months-12 years", ""
            ),
            VaccinationSchedule(
                "Varicella", "Chickenpox", "12-15 months", 1, 2, "13 months-12 years", ""
            ),
            VaccinationSchedule(
                "Hib", "Haemophilus influenzae type b", "12-15 months", 4, 4, None, ""
            ),
            VaccinationSchedule("PCV15/PCV20", "Pneumococcal", "12-15 months", 4, 4, None, ""),
            VaccinationSchedule(
                "Hepatitis A",
                "Hepatitis A",
                "12-23 months",
                1,
                2,
                "2-18 years",
                "2 doses 6 months apart",
            ),
            # 15-18 months
            VaccinationSchedule(
                "DTaP", "Diphtheria, Tetanus, Pertussis", "15-18 months", 4, 5, None, ""
            ),
            # 4-6 years
            VaccinationSchedule(
                "DTaP", "Diphtheria, Tetanus, Pertussis", "4-6 years", 5, 5, None, ""
            ),
            VaccinationSchedule("IPV", "Polio", "4-6 years", 4, 4, None, ""),
            VaccinationSchedule("MMR", "Measles, Mumps, Rubella", "4-6 years", 2, 2, None, ""),
            VaccinationSchedule("Varicella", "Chickenpox", "4-6 years", 2, 2, None, ""),
            # 11-12 years
            VaccinationSchedule(
                "Tdap",
                "Tetanus, Diphtheria, Pertussis",
                "11-12 years",
                1,
                1,
                "13-18 years",
                "Booster",
            ),
            VaccinationSchedule(
                "HPV",
                "Human Papillomavirus",
                "11-12 years",
                1,
                2,
                "13-26 years",
                "2-3 doses based on age",
            ),
            VaccinationSchedule(
                "MenACWY", "Meningococcal", "11-12 years", 1, 2, "13-18 years", "Booster at 16"
            ),
        ]

    def _load_growth_charts(self) -> dict[str, list[GrowthPercentile]]:
        """Load WHO/CDC growth chart data."""
        # Abbreviated dataset - full data from CDC/WHO
        charts: dict[str, list[GrowthPercentile]] = {
            "weight_male": [],
            "weight_female": [],
            "height_male": [],
            "height_female": [],
        }

        # Sample weight data for males (kg) - would load full dataset
        weight_male_data = [
            (0, 2.5, 2.9, 3.3, 3.5, 4.0, 4.4, 4.6),
            (1, 3.4, 3.9, 4.4, 4.5, 5.1, 5.7, 6.0),
            (2, 4.3, 4.9, 5.5, 5.6, 6.3, 7.0, 7.4),
            (3, 5.0, 5.6, 6.4, 6.4, 7.2, 8.0, 8.5),
            (6, 6.4, 7.1, 7.9, 7.9, 8.8, 9.7, 10.2),
            (9, 7.4, 8.2, 9.1, 9.2, 10.2, 11.2, 11.8),
            (12, 8.1, 8.9, 9.9, 10.0, 11.1, 12.2, 12.9),
            (18, 9.2, 10.1, 11.1, 11.3, 12.5, 13.7, 14.5),
            (24, 10.2, 11.1, 12.2, 12.4, 13.7, 15.0, 15.9),
            (36, 11.9, 12.9, 14.2, 14.3, 15.8, 17.4, 18.5),
            (48, 13.6, 14.7, 16.2, 16.3, 18.0, 19.9, 21.2),
            (60, 15.3, 16.6, 18.3, 18.4, 20.4, 22.6, 24.2),
        ]

        for row in weight_male_data:
            charts["weight_male"].append(
                GrowthPercentile(
                    age_months=row[0],
                    sex="male",
                    measurement_type="weight",
                    p5=row[1],
                    p10=row[2],
                    p25=row[3],
                    p50=row[4],
                    p75=row[5],
                    p90=row[6],
                    p95=row[7],
                )
            )

        return charts

    def _get_growth_chart(
        self,
        age_months: int,
        sex: str,
        measurement_type: str,
    ) -> GrowthPercentile | None:
        """Get growth chart for age/sex/measurement."""
        key = f"{measurement_type}_{sex}"
        charts = self._growth_charts.get(key, [])

        # Find closest age
        closest = None
        min_diff = float("inf")

        for chart in charts:
            diff = abs(chart.age_months - age_months)
            if diff < min_diff:
                min_diff = diff
                closest = chart

        return closest

    def _interpolate_percentile(
        self,
        chart: GrowthPercentile,
        value: float,
    ) -> int:
        """Interpolate percentile for a value."""
        percentiles = [
            (5, chart.p5),
            (10, chart.p10),
            (25, chart.p25),
            (50, chart.p50),
            (75, chart.p75),
            (90, chart.p90),
            (95, chart.p95),
        ]

        # Below 5th percentile
        if value < chart.p5:
            return 3

        # Above 95th percentile
        if value > chart.p95:
            return 97

        # Interpolate
        for i in range(len(percentiles) - 1):
            p1, v1 = percentiles[i]
            p2, v2 = percentiles[i + 1]

            if v1 <= value <= v2:
                ratio = (value - v1) / (v2 - v1)
                return int(p1 + ratio * (p2 - p1))

        return 50

    def _parse_age_range(self, age_str: str) -> tuple:
        """Parse age range string to months."""
        # Handle formats like "2 months", "12-15 months", "4-6 years"
        age_str = age_str.lower().strip()

        if "-" in age_str:
            parts = age_str.split("-")
            start = self._parse_single_age(parts[0].strip())
            end = self._parse_single_age(parts[1].strip())
            return (start, end)
        else:
            age = self._parse_single_age(age_str)
            return (age, age + 2)  # 2-month window

    def _parse_single_age(self, age_str: str) -> int:
        """Parse single age to months."""
        age_str = age_str.lower()

        if "year" in age_str:
            years = int("".join(filter(str.isdigit, age_str)) or 0)
            return years * 12
        elif "month" in age_str:
            return int("".join(filter(str.isdigit, age_str)) or 0)
        else:
            # Assume months
            return int("".join(filter(str.isdigit, age_str)) or 0)

    def _get_vital_ranges_for_age(self, age_months: int) -> dict[str, Any]:
        """Get normal vital sign ranges for age."""
        # Based on PALS guidelines
        if age_months < 1:  # Newborn
            return {
                "heart_rate": {
                    "low": 100,
                    "normal_low": 120,
                    "normal_high": 160,
                    "high": 180,
                    "unit": "bpm",
                },
                "respiratory_rate": {
                    "low": 30,
                    "normal_low": 40,
                    "normal_high": 60,
                    "high": 70,
                    "unit": "/min",
                },
                "temperature": {
                    "low": 97.7,
                    "normal_low": 98.0,
                    "normal_high": 99.5,
                    "high": 100.4,
                    "unit": "°F",
                },
            }
        elif age_months < 12:  # Infant
            return {
                "heart_rate": {
                    "low": 80,
                    "normal_low": 100,
                    "normal_high": 150,
                    "high": 170,
                    "unit": "bpm",
                },
                "respiratory_rate": {
                    "low": 25,
                    "normal_low": 30,
                    "normal_high": 50,
                    "high": 60,
                    "unit": "/min",
                },
                "temperature": {
                    "low": 97.7,
                    "normal_low": 98.0,
                    "normal_high": 99.5,
                    "high": 100.4,
                    "unit": "°F",
                },
            }
        elif age_months < 36:  # Toddler
            return {
                "heart_rate": {
                    "low": 70,
                    "normal_low": 90,
                    "normal_high": 140,
                    "high": 160,
                    "unit": "bpm",
                },
                "respiratory_rate": {
                    "low": 20,
                    "normal_low": 24,
                    "normal_high": 40,
                    "high": 50,
                    "unit": "/min",
                },
                "temperature": {
                    "low": 97.5,
                    "normal_low": 98.0,
                    "normal_high": 99.5,
                    "high": 100.4,
                    "unit": "°F",
                },
            }
        elif age_months < 72:  # Preschool
            return {
                "heart_rate": {
                    "low": 65,
                    "normal_low": 80,
                    "normal_high": 120,
                    "high": 140,
                    "unit": "bpm",
                },
                "respiratory_rate": {
                    "low": 18,
                    "normal_low": 22,
                    "normal_high": 34,
                    "high": 40,
                    "unit": "/min",
                },
                "temperature": {
                    "low": 97.5,
                    "normal_low": 98.0,
                    "normal_high": 99.5,
                    "high": 100.4,
                    "unit": "°F",
                },
            }
        else:  # School age
            return {
                "heart_rate": {
                    "low": 55,
                    "normal_low": 70,
                    "normal_high": 110,
                    "high": 130,
                    "unit": "bpm",
                },
                "respiratory_rate": {
                    "low": 14,
                    "normal_low": 18,
                    "normal_high": 30,
                    "high": 35,
                    "unit": "/min",
                },
                "temperature": {
                    "low": 97.5,
                    "normal_low": 98.0,
                    "normal_high": 99.5,
                    "high": 100.4,
                    "unit": "°F",
                },
            }

    def _get_age_group(self, age_months: int) -> str:
        """Get age group label."""
        if age_months < 1:
            return "Newborn"
        elif age_months < 12:
            return "Infant"
        elif age_months < 36:
            return "Toddler"
        elif age_months < 72:
            return "Preschool"
        elif age_months < 144:
            return "School Age"
        else:
            return "Adolescent"

    def _get_cached(self, key: str) -> Any | None:
        """Get cached result if not expired."""
        if key in self._cache:
            result, timestamp = self._cache[key]
            if datetime.now(__import__("datetime").timezone.utc) - timestamp < timedelta(
                hours=self.cache_ttl_hours
            ):
                return result
            del self._cache[key]
        return None

    def _set_cached(self, key: str, value: Any) -> None:
        """Set cached result."""
        self._cache[key] = (value, datetime.now(__import__("datetime").timezone.utc))
