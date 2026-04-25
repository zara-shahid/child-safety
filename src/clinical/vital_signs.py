"""
Age-Adjusted Vital Sign Normalization

Provides z-score normalization and threshold assessment for pediatric vital signs
based on age-specific reference ranges from validated clinical studies.

References:
- Fleming et al. (2011) - Normal ranges for heart rate and respiratory rate
- Pediatric Advanced Life Support (PALS) guidelines
- Phoenix Sepsis Criteria age-adjusted MAP thresholds
"""

from dataclasses import dataclass
from enum import Enum


class VitalSignStatus(Enum):
    """Status of a vital sign relative to normal range."""

    CRITICALLY_LOW = "critically_low"
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICALLY_HIGH = "critically_high"


@dataclass
class VitalSignRange:
    """Age-specific vital sign reference range."""

    age_min_months: int
    age_max_months: int

    # Heart rate (bpm)
    hr_low: int
    hr_normal_low: int
    hr_normal_high: int
    hr_high: int

    # Respiratory rate (breaths/min)
    rr_low: int
    rr_normal_low: int
    rr_normal_high: int
    rr_high: int

    # Systolic blood pressure (mmHg)
    sbp_low: int
    sbp_normal_low: int
    sbp_normal_high: int
    sbp_high: int

    # Mean arterial pressure (mmHg) - Phoenix criteria thresholds
    map_critical_low: int


# Age-specific reference ranges based on validated pediatric data
VITAL_SIGN_RANGES: list[VitalSignRange] = [
    # Newborn (0-1 month)
    VitalSignRange(
        age_min_months=0,
        age_max_months=1,
        hr_low=90,
        hr_normal_low=100,
        hr_normal_high=160,
        hr_high=180,
        rr_low=25,
        rr_normal_low=30,
        rr_normal_high=50,
        rr_high=60,
        sbp_low=50,
        sbp_normal_low=60,
        sbp_normal_high=80,
        sbp_high=90,
        map_critical_low=31,
    ),
    # Infant (1-3 months)
    VitalSignRange(
        age_min_months=1,
        age_max_months=3,
        hr_low=100,
        hr_normal_low=110,
        hr_normal_high=160,
        hr_high=180,
        rr_low=25,
        rr_normal_low=30,
        rr_normal_high=45,
        rr_high=55,
        sbp_low=55,
        sbp_normal_low=65,
        sbp_normal_high=85,
        sbp_high=95,
        map_critical_low=31,
    ),
    # Infant (3-6 months)
    VitalSignRange(
        age_min_months=3,
        age_max_months=6,
        hr_low=90,
        hr_normal_low=100,
        hr_normal_high=150,
        hr_high=170,
        rr_low=22,
        rr_normal_low=25,
        rr_normal_high=40,
        rr_high=50,
        sbp_low=60,
        sbp_normal_low=70,
        sbp_normal_high=90,
        sbp_high=100,
        map_critical_low=32,
    ),
    # Infant (6-12 months)
    VitalSignRange(
        age_min_months=6,
        age_max_months=12,
        hr_low=80,
        hr_normal_low=90,
        hr_normal_high=140,
        hr_high=160,
        rr_low=20,
        rr_normal_low=22,
        rr_normal_high=35,
        rr_high=45,
        sbp_low=65,
        sbp_normal_low=75,
        sbp_normal_high=95,
        sbp_high=105,
        map_critical_low=34,
    ),
    # Toddler (1-2 years)
    VitalSignRange(
        age_min_months=12,
        age_max_months=24,
        hr_low=70,
        hr_normal_low=80,
        hr_normal_high=130,
        hr_high=150,
        rr_low=18,
        rr_normal_low=20,
        rr_normal_high=30,
        rr_high=40,
        sbp_low=70,
        sbp_normal_low=80,
        sbp_normal_high=100,
        sbp_high=110,
        map_critical_low=35,
    ),
    # Preschool (2-4 years)
    VitalSignRange(
        age_min_months=24,
        age_max_months=48,
        hr_low=65,
        hr_normal_low=75,
        hr_normal_high=120,
        hr_high=140,
        rr_low=16,
        rr_normal_low=18,
        rr_normal_high=26,
        rr_high=34,
        sbp_low=75,
        sbp_normal_low=85,
        sbp_normal_high=105,
        sbp_high=115,
        map_critical_low=38,
    ),
    # School age (4-6 years)
    VitalSignRange(
        age_min_months=48,
        age_max_months=72,
        hr_low=60,
        hr_normal_low=70,
        hr_normal_high=110,
        hr_high=130,
        rr_low=14,
        rr_normal_low=16,
        rr_normal_high=24,
        rr_high=30,
        sbp_low=80,
        sbp_normal_low=90,
        sbp_normal_high=110,
        sbp_high=120,
        map_critical_low=40,
    ),
    # School age (6-10 years)
    VitalSignRange(
        age_min_months=72,
        age_max_months=120,
        hr_low=55,
        hr_normal_low=65,
        hr_normal_high=105,
        hr_high=120,
        rr_low=12,
        rr_normal_low=14,
        rr_normal_high=22,
        rr_high=28,
        sbp_low=85,
        sbp_normal_low=95,
        sbp_normal_high=115,
        sbp_high=125,
        map_critical_low=44,
    ),
    # Pre-adolescent (10-12 years)
    VitalSignRange(
        age_min_months=120,
        age_max_months=144,
        hr_low=50,
        hr_normal_low=60,
        hr_normal_high=100,
        hr_high=115,
        rr_low=12,
        rr_normal_low=12,
        rr_normal_high=20,
        rr_high=26,
        sbp_low=90,
        sbp_normal_low=100,
        sbp_normal_high=120,
        sbp_high=130,
        map_critical_low=48,
    ),
    # Adolescent (12-18 years)
    VitalSignRange(
        age_min_months=144,
        age_max_months=216,
        hr_low=45,
        hr_normal_low=55,
        hr_normal_high=95,
        hr_high=110,
        rr_low=10,
        rr_normal_low=12,
        rr_normal_high=18,
        rr_high=24,
        sbp_low=95,
        sbp_normal_low=105,
        sbp_normal_high=125,
        sbp_high=135,
        map_critical_low=52,
    ),
]


@dataclass
class AgeAdjustedVitals:
    """Age-adjusted vital sign assessment results."""

    age_months: int

    # Raw values
    heart_rate: int | None = None
    respiratory_rate: int | None = None
    systolic_bp: int | None = None
    diastolic_bp: int | None = None
    mean_arterial_pressure: float | None = None
    oxygen_saturation: float | None = None
    temperature: float | None = None

    # Z-scores (standard deviations from mean)
    hr_zscore: float | None = None
    rr_zscore: float | None = None
    sbp_zscore: float | None = None

    # Status assessments
    hr_status: VitalSignStatus = VitalSignStatus.NORMAL
    rr_status: VitalSignStatus = VitalSignStatus.NORMAL
    sbp_status: VitalSignStatus = VitalSignStatus.NORMAL
    spo2_status: VitalSignStatus = VitalSignStatus.NORMAL
    temp_status: VitalSignStatus = VitalSignStatus.NORMAL

    # Flags
    map_below_threshold: bool = False
    tachycardia: bool = False
    bradycardia: bool = False
    tachypnea: bool = False
    hypotension: bool = False
    hypoxia: bool = False
    fever: bool = False
    hypothermia: bool = False


class VitalSignNormalizer:
    """
    Normalizes vital signs based on age-specific reference ranges.

    Provides z-score calculations and status assessments for
    pediatric vital signs, accounting for age-dependent normal values.
    """

    def __init__(self) -> None:
        self.ranges: list[VitalSignRange] = VITAL_SIGN_RANGES

    def get_range_for_age(self, age_months: int) -> VitalSignRange:
        """Get the appropriate vital sign range for a given age."""
        for r in self.ranges:
            if r.age_min_months <= age_months < r.age_max_months:
                return r
        # Default to adolescent range for older children
        return self.ranges[-1]

    def normalize(
        self,
        age_months: int,
        heart_rate: int | None = None,
        respiratory_rate: int | None = None,
        systolic_bp: int | None = None,
        diastolic_bp: int | None = None,
        oxygen_saturation: float | None = None,
        temperature: float | None = None,
    ) -> AgeAdjustedVitals:
        """
        Normalize vital signs for the given age.

        Args:
            age_months: Child's age in months
            heart_rate: Heart rate in bpm
            respiratory_rate: Respiratory rate in breaths/min
            systolic_bp: Systolic blood pressure in mmHg
            diastolic_bp: Diastolic blood pressure in mmHg
            oxygen_saturation: SpO2 percentage
            temperature: Temperature in Celsius

        Returns:
            AgeAdjustedVitals with normalized values and status assessments
        """
        ref = self.get_range_for_age(age_months)

        result = AgeAdjustedVitals(age_months=age_months)

        # Heart rate assessment
        if heart_rate is not None:
            result.heart_rate = heart_rate
            result.hr_zscore = self._calculate_zscore(
                heart_rate,
                ref.hr_normal_low,
                ref.hr_normal_high,
            )
            result.hr_status = self._assess_status(
                heart_rate,
                ref.hr_low,
                ref.hr_normal_low,
                ref.hr_normal_high,
                ref.hr_high,
            )
            result.tachycardia = heart_rate > ref.hr_normal_high
            result.bradycardia = heart_rate < ref.hr_normal_low

        # Respiratory rate assessment
        if respiratory_rate is not None:
            result.respiratory_rate = respiratory_rate
            result.rr_zscore = self._calculate_zscore(
                respiratory_rate,
                ref.rr_normal_low,
                ref.rr_normal_high,
            )
            result.rr_status = self._assess_status(
                respiratory_rate,
                ref.rr_low,
                ref.rr_normal_low,
                ref.rr_normal_high,
                ref.rr_high,
            )
            result.tachypnea = respiratory_rate > ref.rr_normal_high

        # Blood pressure assessment
        if systolic_bp is not None:
            result.systolic_bp = systolic_bp
            result.sbp_zscore = self._calculate_zscore(
                systolic_bp,
                ref.sbp_normal_low,
                ref.sbp_normal_high,
            )
            result.sbp_status = self._assess_status(
                systolic_bp,
                ref.sbp_low,
                ref.sbp_normal_low,
                ref.sbp_normal_high,
                ref.sbp_high,
            )
            result.hypotension = systolic_bp < ref.sbp_low

        if diastolic_bp is not None:
            result.diastolic_bp = diastolic_bp

        # Calculate MAP if we have both SBP and DBP
        if systolic_bp is not None and diastolic_bp is not None:
            result.mean_arterial_pressure = diastolic_bp + (systolic_bp - diastolic_bp) / 3
            result.map_below_threshold = result.mean_arterial_pressure < ref.map_critical_low

        # Oxygen saturation assessment
        if oxygen_saturation is not None:
            result.oxygen_saturation = oxygen_saturation
            if oxygen_saturation < 90:
                result.spo2_status = VitalSignStatus.CRITICALLY_LOW
                result.hypoxia = True
            elif oxygen_saturation < 94:
                result.spo2_status = VitalSignStatus.LOW
                result.hypoxia = True
            elif oxygen_saturation >= 97:
                result.spo2_status = VitalSignStatus.NORMAL
            else:
                result.spo2_status = VitalSignStatus.NORMAL

        # Temperature assessment
        if temperature is not None:
            result.temperature = temperature
            if temperature < 35.0:
                result.temp_status = VitalSignStatus.CRITICALLY_LOW
                result.hypothermia = True
            elif temperature < 36.0:
                result.temp_status = VitalSignStatus.LOW
                result.hypothermia = True
            elif temperature <= 37.5:
                result.temp_status = VitalSignStatus.NORMAL
            elif temperature < 38.0:
                result.temp_status = VitalSignStatus.HIGH
            elif temperature < 40.0:
                result.temp_status = VitalSignStatus.HIGH
                result.fever = True
            else:
                result.temp_status = VitalSignStatus.CRITICALLY_HIGH
                result.fever = True

        return result

    def _calculate_zscore(
        self,
        value: float,
        normal_low: float,
        normal_high: float,
    ) -> float:
        """
        Calculate approximate z-score based on normal range.

        Assumes normal range represents approximately ±2 SD from mean.
        """
        mean = (normal_low + normal_high) / 2
        # Estimate SD as range/4 (±2 SD)
        sd = (normal_high - normal_low) / 4
        if sd == 0:
            return 0.0
        return (value - mean) / sd

    def _assess_status(
        self,
        value: float,
        critical_low: float,
        normal_low: float,
        normal_high: float,
        critical_high: float,
    ) -> VitalSignStatus:
        """Assess vital sign status based on thresholds."""
        if value < critical_low:
            return VitalSignStatus.CRITICALLY_LOW
        elif value < normal_low:
            return VitalSignStatus.LOW
        elif value <= normal_high:
            return VitalSignStatus.NORMAL
        elif value <= critical_high:
            return VitalSignStatus.HIGH
        else:
            return VitalSignStatus.CRITICALLY_HIGH

    def get_critical_map_threshold(self, age_months: int) -> int:
        """Get the Phoenix criteria MAP threshold for the given age."""
        ref = self.get_range_for_age(age_months)
        return ref.map_critical_low
