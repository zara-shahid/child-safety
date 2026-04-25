"""
Phoenix Sepsis Score Calculator

Implements the 2024 Phoenix Criteria for Pediatric Sepsis and Septic Shock
as published in JAMA (January 2024).

The Phoenix criteria assess four organ systems:
1. Respiratory (0-3 points)
2. Cardiovascular (0-6 points)
3. Coagulation (0-2 points)
4. Neurological (0-2 points)

Sepsis: Phoenix Score >= 2 in a patient with suspected infection
Septic Shock: Sepsis + Cardiovascular Score >= 1

References:
- Sanchez-Pinto LN, et al. Development and Validation of the Phoenix
  Criteria for Pediatric Sepsis and Septic Shock. JAMA. 2024.
- MDCalc Phoenix Sepsis Score Calculator
- phoenix R package (CRAN)
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from .vital_signs import VitalSignNormalizer

logger = logging.getLogger("epcid.clinical.phoenix")


class VentilationType(Enum):
    """Type of respiratory support."""

    NONE = "none"
    SUPPLEMENTAL_O2 = "supplemental_o2"  # Nasal cannula, face mask
    NON_INVASIVE = "non_invasive"  # CPAP, BiPAP, HFNC
    INVASIVE = "invasive"  # Intubated, mechanical ventilation


@dataclass
class RespiratoryAssessment:
    """Respiratory system assessment for Phoenix Score."""

    # Oxygenation metrics
    pao2: float | None = None  # mmHg
    fio2: float | None = None  # Fraction (0-1)
    spo2: float | None = None  # Percentage

    # Ventilation status
    ventilation_type: VentilationType = VentilationType.NONE
    on_invasive_ventilation: bool = False

    # Calculated ratios
    pao2_fio2_ratio: float | None = None
    spo2_fio2_ratio: float | None = None

    # Score
    score: int = 0
    score_components: list[str] = field(default_factory=list)


@dataclass
class CardiovascularAssessment:
    """Cardiovascular system assessment for Phoenix Score."""

    # Vital signs
    systolic_bp: int | None = None
    diastolic_bp: int | None = None
    mean_arterial_pressure: float | None = None
    age_months: int | None = None

    # Lactate
    lactate: float | None = None  # mmol/L

    # Vasoactive medications (boolean for presence)
    vasoactive_medications: list[str] = field(default_factory=list)
    dobutamine: bool = False
    dopamine: bool = False
    epinephrine: bool = False
    milrinone: bool = False
    norepinephrine: bool = False
    vasopressin: bool = False

    # Score
    score: int = 0
    score_components: list[str] = field(default_factory=list)

    # Flags
    map_below_threshold: bool = False
    elevated_lactate: bool = False


@dataclass
class CoagulationAssessment:
    """Coagulation system assessment for Phoenix Score."""

    platelet_count: int | None = None  # x10^9/L (thousands)
    inr: float | None = None
    d_dimer: float | None = None  # mg/L FEU
    fibrinogen: float | None = None  # mg/dL

    # Score
    score: int = 0
    score_components: list[str] = field(default_factory=list)


@dataclass
class NeurologicalAssessment:
    """Neurological system assessment for Phoenix Score."""

    # Glasgow Coma Scale components
    gcs_total: int | None = None
    gcs_eye: int | None = None  # 1-4
    gcs_verbal: int | None = None  # 1-5
    gcs_motor: int | None = None  # 1-6

    # Pupil reactivity
    pupils_fixed: bool = False
    bilateral_fixed_pupils: bool = False

    # Alternative: AVPU scale
    avpu: str | None = None  # "A", "V", "P", "U"

    # Score
    score: int = 0
    score_components: list[str] = field(default_factory=list)


@dataclass
class PhoenixScore:
    """Complete Phoenix Sepsis Score assessment."""

    # Component scores
    respiratory: RespiratoryAssessment = field(default_factory=RespiratoryAssessment)
    cardiovascular: CardiovascularAssessment = field(default_factory=CardiovascularAssessment)
    coagulation: CoagulationAssessment = field(default_factory=CoagulationAssessment)
    neurological: NeurologicalAssessment = field(default_factory=NeurologicalAssessment)

    # Total score
    total_score: int = 0

    # Diagnostic criteria
    suspected_infection: bool = False
    meets_sepsis_criteria: bool = False
    meets_septic_shock_criteria: bool = False

    # Risk assessment
    risk_level: str = "low"  # low, moderate, high, critical

    # Explanation
    summary: str = ""
    contributing_factors: list[str] = field(default_factory=list)
    missing_data: list[str] = field(default_factory=list)

    # Confidence based on available data
    confidence: float = 0.5


class PhoenixScoreCalculator:
    """
    Calculator for the Phoenix Pediatric Sepsis Score.

    The Phoenix criteria provide a validated, data-driven approach to
    identifying pediatric sepsis and septic shock, replacing previous
    consensus-based definitions.

    Usage:
        calculator = PhoenixScoreCalculator()
        score = calculator.calculate(
            age_months=24,
            spo2=92,
            fio2=0.4,
            on_invasive_ventilation=True,
            systolic_bp=70,
            diastolic_bp=40,
            lactate=4.5,
            platelet_count=80,
            gcs_total=12,
            suspected_infection=True,
        )

        if score.meets_sepsis_criteria:
            print(f"Sepsis identified, score: {score.total_score}")
    """

    # MAP thresholds by age (months) from Phoenix criteria
    MAP_THRESHOLDS = [
        (0, 1, 31),  # 0-<1 month: MAP >= 31
        (1, 12, 32),  # 1-<12 months: MAP >= 32
        (12, 24, 34),  # 1-<2 years: MAP >= 34
        (24, 60, 36),  # 2-<5 years: MAP >= 36
        (60, 144, 40),  # 5-<12 years: MAP >= 40
        (144, 216, 46),  # 12-<18 years: MAP >= 46
    ]

    def __init__(self) -> None:
        self.vital_normalizer = VitalSignNormalizer()

    def calculate(
        self,
        age_months: int,
        # Respiratory parameters
        pao2: float | None = None,
        fio2: float | None = None,
        spo2: float | None = None,
        on_invasive_ventilation: bool = False,
        ventilation_type: VentilationType = VentilationType.NONE,
        # Cardiovascular parameters
        systolic_bp: int | None = None,
        diastolic_bp: int | None = None,
        lactate: float | None = None,
        vasoactive_medications: list[str] | None = None,
        # Coagulation parameters
        platelet_count: int | None = None,
        inr: float | None = None,
        d_dimer: float | None = None,
        fibrinogen: float | None = None,
        # Neurological parameters
        gcs_total: int | None = None,
        pupils_fixed: bool = False,
        bilateral_fixed_pupils: bool = False,
        avpu: str | None = None,
        # Clinical context
        suspected_infection: bool = False,
    ) -> PhoenixScore:
        """
        Calculate the Phoenix Sepsis Score.

        Args:
            age_months: Patient age in months
            pao2: Arterial oxygen pressure (mmHg)
            fio2: Fraction of inspired oxygen (0-1)
            spo2: Oxygen saturation (%)
            on_invasive_ventilation: Whether on invasive mechanical ventilation
            ventilation_type: Type of respiratory support
            systolic_bp: Systolic blood pressure (mmHg)
            diastolic_bp: Diastolic blood pressure (mmHg)
            lactate: Blood lactate level (mmol/L)
            vasoactive_medications: List of vasoactive medication names
            platelet_count: Platelet count (x10^9/L)
            inr: International normalized ratio
            d_dimer: D-dimer level (mg/L FEU)
            fibrinogen: Fibrinogen level (mg/dL)
            gcs_total: Glasgow Coma Scale total score
            pupils_fixed: Whether any pupils are fixed
            bilateral_fixed_pupils: Whether both pupils are fixed
            avpu: AVPU scale assessment (A/V/P/U)
            suspected_infection: Whether infection is suspected

        Returns:
            PhoenixScore with complete assessment
        """
        result = PhoenixScore(suspected_infection=suspected_infection)

        # Calculate component scores
        result.respiratory = self._calculate_respiratory(
            pao2=pao2,
            fio2=fio2,
            spo2=spo2,
            on_invasive_ventilation=on_invasive_ventilation,
            ventilation_type=ventilation_type,
        )

        result.cardiovascular = self._calculate_cardiovascular(
            age_months=age_months,
            systolic_bp=systolic_bp,
            diastolic_bp=diastolic_bp,
            lactate=lactate,
            vasoactive_medications=vasoactive_medications or [],
        )

        result.coagulation = self._calculate_coagulation(
            platelet_count=platelet_count,
            inr=inr,
            d_dimer=d_dimer,
            fibrinogen=fibrinogen,
        )

        result.neurological = self._calculate_neurological(
            gcs_total=gcs_total,
            pupils_fixed=pupils_fixed,
            bilateral_fixed_pupils=bilateral_fixed_pupils,
            avpu=avpu,
        )

        # Calculate total score
        result.total_score = (
            result.respiratory.score
            + result.cardiovascular.score
            + result.coagulation.score
            + result.neurological.score
        )

        # Determine sepsis criteria
        if suspected_infection and result.total_score >= 2:
            result.meets_sepsis_criteria = True

            # Check for septic shock
            if result.cardiovascular.score >= 1:
                result.meets_septic_shock_criteria = True

        # Determine risk level
        result.risk_level = self._determine_risk_level(result)

        # Collect contributing factors
        result.contributing_factors = self._collect_contributing_factors(result)

        # Identify missing data
        result.missing_data = self._identify_missing_data(
            pao2=pao2,
            fio2=fio2,
            spo2=spo2,
            systolic_bp=systolic_bp,
            diastolic_bp=diastolic_bp,
            lactate=lactate,
            platelet_count=platelet_count,
            inr=inr,
            gcs_total=gcs_total,
            avpu=avpu,
        )

        # Calculate confidence
        result.confidence = self._calculate_confidence(result)

        # Generate summary
        result.summary = self._generate_summary(result)

        return result

    def _calculate_respiratory(
        self,
        pao2: float | None,
        fio2: float | None,
        spo2: float | None,
        on_invasive_ventilation: bool,
        ventilation_type: VentilationType,
    ) -> RespiratoryAssessment:
        """
        Calculate respiratory component score.

        Scoring (0-3 points):
        - Uses PaO2:FiO2 ratio if available, otherwise SpO2:FiO2 ratio
        - Additional point if on invasive mechanical ventilation

        PaO2:FiO2 thresholds:
        - >=400: 0 points
        - 300-<400: 1 point
        - 200-<300: 2 points (IMV required)
        - <200: 2 points (IMV required)
        - <100: 3 points (IMV required)

        SpO2:FiO2 thresholds (if PaO2 unavailable):
        - >=292: 0 points
        - 264-<292: 1 point
        - 221-<264: 1 point
        - <221: 2 points
        - <148: 2 points (IMV adds 1)
        """
        assessment = RespiratoryAssessment(
            pao2=pao2,
            fio2=fio2,
            spo2=spo2,
            on_invasive_ventilation=on_invasive_ventilation,
            ventilation_type=ventilation_type,
        )

        score = 0
        components = []

        # Calculate ratios
        if pao2 is not None and fio2 is not None and fio2 > 0:
            pf_ratio = pao2 / fio2
            assessment.pao2_fio2_ratio = pf_ratio

            # Score based on PaO2:FiO2
            if pf_ratio < 100 and on_invasive_ventilation:
                score = 3
                components.append(f"PaO2:FiO2 {pf_ratio:.0f} (<100, IMV)")
            elif pf_ratio < 200 and on_invasive_ventilation:
                score = 2
                components.append(f"PaO2:FiO2 {pf_ratio:.0f} (<200, IMV)")
            elif pf_ratio < 300:
                score = 1
                components.append(f"PaO2:FiO2 {pf_ratio:.0f} (<300)")
            elif pf_ratio < 400:
                score = 1
                components.append(f"PaO2:FiO2 {pf_ratio:.0f} (<400)")
            else:
                components.append(f"PaO2:FiO2 {pf_ratio:.0f} (normal)")

        elif spo2 is not None and fio2 is not None and fio2 > 0:
            # Use SpO2:FiO2 as alternative
            # Convert FiO2 fraction to percentage for calculation
            fio2_pct = fio2 * 100 if fio2 <= 1 else fio2
            sf_ratio = (spo2 / fio2_pct) * 100
            assessment.spo2_fio2_ratio = sf_ratio

            if sf_ratio < 148:
                score = 2 if on_invasive_ventilation else 2
                if on_invasive_ventilation:
                    score = 3
                components.append(f"SpO2:FiO2 {sf_ratio:.0f} (<148)")
            elif sf_ratio < 221:
                score = 2
                components.append(f"SpO2:FiO2 {sf_ratio:.0f} (<221)")
            elif sf_ratio < 264:
                score = 1
                components.append(f"SpO2:FiO2 {sf_ratio:.0f} (<264)")
            elif sf_ratio < 292:
                score = 1
                components.append(f"SpO2:FiO2 {sf_ratio:.0f} (<292)")
            else:
                components.append(f"SpO2:FiO2 {sf_ratio:.0f} (normal)")

        elif spo2 is not None:
            # Use SpO2 alone as rough indicator
            if spo2 < 90:
                score = 2
                components.append(f"SpO2 {spo2}% (severely low)")
            elif spo2 < 94:
                score = 1
                components.append(f"SpO2 {spo2}% (low)")

        assessment.score = min(3, score)  # Cap at 3
        assessment.score_components = components

        return assessment

    def _calculate_cardiovascular(
        self,
        age_months: int,
        systolic_bp: int | None,
        diastolic_bp: int | None,
        lactate: float | None,
        vasoactive_medications: list[str],
    ) -> CardiovascularAssessment:
        """
        Calculate cardiovascular component score.

        Scoring (0-6 points, sum of three subscores):

        1. Vasoactive medications (0-2):
           - 0 meds: 0 points
           - 1 med: 1 point
           - >=2 meds: 2 points

        2. Lactate (0-2):
           - <5 mmol/L: 0 points
           - 5-<11 mmol/L: 1 point
           - >=11 mmol/L: 2 points

        3. Age-adjusted MAP (0-2):
           - MAP above age threshold: 0 points
           - MAP below age threshold: 1-2 points (severity dependent)
        """
        assessment = CardiovascularAssessment(
            systolic_bp=systolic_bp,
            diastolic_bp=diastolic_bp,
            age_months=age_months,
            lactate=lactate,
            vasoactive_medications=vasoactive_medications,
        )

        score = 0
        components = []

        # Known vasoactive medications for Phoenix criteria
        known_vasoactives = {
            "dobutamine",
            "dopamine",
            "epinephrine",
            "milrinone",
            "norepinephrine",
            "vasopressin",
        }

        # Count vasoactive medications
        vaso_count = 0
        for med in vasoactive_medications:
            med_lower = med.lower()
            if any(v in med_lower for v in known_vasoactives):
                vaso_count += 1

                # Set individual flags
                if "dobutamine" in med_lower:
                    assessment.dobutamine = True
                elif "dopamine" in med_lower:
                    assessment.dopamine = True
                elif "epinephrine" in med_lower:
                    assessment.epinephrine = True
                elif "milrinone" in med_lower:
                    assessment.milrinone = True
                elif "norepinephrine" in med_lower:
                    assessment.norepinephrine = True
                elif "vasopressin" in med_lower:
                    assessment.vasopressin = True

        # Vasoactive score
        if vaso_count >= 2:
            score += 2
            components.append(f"{vaso_count} vasoactive medications")
        elif vaso_count == 1:
            score += 1
            components.append("1 vasoactive medication")

        # Lactate score
        if lactate is not None:
            assessment.lactate = lactate
            if lactate >= 11:
                score += 2
                assessment.elevated_lactate = True
                components.append(f"Lactate {lactate} mmol/L (>=11)")
            elif lactate >= 5:
                score += 1
                assessment.elevated_lactate = True
                components.append(f"Lactate {lactate} mmol/L (5-11)")

        # MAP score
        if systolic_bp is not None and diastolic_bp is not None:
            map_value = diastolic_bp + (systolic_bp - diastolic_bp) / 3
            assessment.mean_arterial_pressure = map_value

            map_threshold = self._get_map_threshold(age_months)

            if map_value < map_threshold:
                # Below threshold
                deficit = map_threshold - map_value
                if deficit >= 10:
                    score += 2
                    components.append(
                        f"MAP {map_value:.0f} mmHg (severely below threshold {map_threshold})"
                    )
                else:
                    score += 1
                    components.append(f"MAP {map_value:.0f} mmHg (below threshold {map_threshold})")
                assessment.map_below_threshold = True

        assessment.score = min(6, score)  # Cap at 6
        assessment.score_components = components

        return assessment

    def _calculate_coagulation(
        self,
        platelet_count: int | None,
        inr: float | None,
        d_dimer: float | None,
        fibrinogen: float | None,
    ) -> CoagulationAssessment:
        """
        Calculate coagulation component score.

        Scoring (0-2 points):
        - Platelets >=100: 0 points
        - Platelets <100: 1 point
        - INR >1.3 or D-dimer >2: additional consideration
        - Fibrinogen <100: additional consideration
        """
        assessment = CoagulationAssessment(
            platelet_count=platelet_count,
            inr=inr,
            d_dimer=d_dimer,
            fibrinogen=fibrinogen,
        )

        score = 0
        components = []

        # Platelet score
        if platelet_count is not None:
            if platelet_count < 100:
                score += 1
                components.append(f"Platelets {platelet_count} (<100)")

            if platelet_count < 50:
                score += 1
                components.append("Severe thrombocytopenia (<50)")

        # INR consideration
        if inr is not None and inr > 1.3:
            components.append(f"INR {inr} (elevated)")

        # D-dimer consideration
        if d_dimer is not None and d_dimer > 2:
            components.append(f"D-dimer {d_dimer} (elevated)")

        # Fibrinogen consideration
        if fibrinogen is not None and fibrinogen < 100:
            components.append(f"Fibrinogen {fibrinogen} (low)")

        assessment.score = min(2, score)  # Cap at 2
        assessment.score_components = components

        return assessment

    def _calculate_neurological(
        self,
        gcs_total: int | None,
        pupils_fixed: bool,
        bilateral_fixed_pupils: bool,
        avpu: str | None,
    ) -> NeurologicalAssessment:
        """
        Calculate neurological component score.

        Scoring (0-2 points):
        - GCS 15: 0 points
        - GCS 11-14: 1 point
        - GCS <=10: 2 points
        - Bilateral fixed pupils: 2 points

        AVPU conversion:
        - A (Alert): GCS ~15
        - V (Verbal): GCS ~12
        - P (Pain): GCS ~8
        - U (Unresponsive): GCS ~3
        """
        assessment = NeurologicalAssessment(
            gcs_total=gcs_total,
            pupils_fixed=pupils_fixed,
            bilateral_fixed_pupils=bilateral_fixed_pupils,
            avpu=avpu,
        )

        score = 0
        components = []

        # Convert AVPU to GCS if needed
        effective_gcs = gcs_total
        if effective_gcs is None and avpu is not None:
            avpu_to_gcs = {"A": 15, "V": 12, "P": 8, "U": 3}
            effective_gcs = avpu_to_gcs.get(avpu.upper(), 15)
            components.append(f"AVPU: {avpu} (estimated GCS {effective_gcs})")

        # GCS score
        if effective_gcs is not None:
            assessment.gcs_total = effective_gcs
            if effective_gcs <= 10:
                score = 2
                components.append(f"GCS {effective_gcs} (<=10)")
            elif effective_gcs <= 14:
                score = 1
                components.append(f"GCS {effective_gcs} (11-14)")

        # Bilateral fixed pupils override
        if bilateral_fixed_pupils:
            score = 2
            components.append("Bilateral fixed pupils")
        elif pupils_fixed:
            components.append("Fixed pupil(s) present")

        assessment.score = min(2, score)  # Cap at 2
        assessment.score_components = components

        return assessment

    def _get_map_threshold(self, age_months: int) -> int:
        """Get the age-appropriate MAP threshold for Phoenix criteria."""
        for min_age, max_age, threshold in self.MAP_THRESHOLDS:
            if min_age <= age_months < max_age:
                return threshold
        return 46  # Default to adolescent threshold

    def _determine_risk_level(self, result: PhoenixScore) -> str:
        """Determine overall risk level from Phoenix score."""
        if result.meets_septic_shock_criteria:
            return "critical"
        elif result.meets_sepsis_criteria:
            return "high"
        elif result.total_score >= 1:
            return "moderate"
        else:
            return "low"

    def _collect_contributing_factors(self, result: PhoenixScore) -> list[str]:
        """Collect all contributing factors from component assessments."""
        factors = []

        factors.extend(result.respiratory.score_components)
        factors.extend(result.cardiovascular.score_components)
        factors.extend(result.coagulation.score_components)
        factors.extend(result.neurological.score_components)

        if result.meets_sepsis_criteria:
            factors.append("Meets Phoenix Sepsis Criteria (Score >= 2)")
        if result.meets_septic_shock_criteria:
            factors.append("Meets Septic Shock Criteria (CV Score >= 1)")

        return factors

    def _identify_missing_data(self, **kwargs: Any) -> list[str]:
        """Identify missing data that would improve assessment."""
        missing = []

        # Key parameters for full assessment
        if kwargs.get("pao2") is None and kwargs.get("spo2") is None:
            missing.append("Oxygenation data (PaO2 or SpO2)")

        if kwargs.get("systolic_bp") is None:
            missing.append("Blood pressure")

        if kwargs.get("lactate") is None:
            missing.append("Lactate level")

        if kwargs.get("platelet_count") is None:
            missing.append("Platelet count")

        if kwargs.get("gcs_total") is None and kwargs.get("avpu") is None:
            missing.append("Neurological assessment (GCS or AVPU)")

        return missing

    def _calculate_confidence(self, result: PhoenixScore) -> float:
        """Calculate confidence based on available data."""
        # Base confidence
        confidence = 0.5

        # Increase based on available data
        has_respiratory = (
            result.respiratory.pao2_fio2_ratio is not None
            or result.respiratory.spo2_fio2_ratio is not None
        )
        has_cv = (
            result.cardiovascular.mean_arterial_pressure is not None
            or result.cardiovascular.lactate is not None
        )
        has_coag = result.coagulation.platelet_count is not None
        has_neuro = result.neurological.gcs_total is not None

        if has_respiratory:
            confidence += 0.15
        if has_cv:
            confidence += 0.15
        if has_coag:
            confidence += 0.1
        if has_neuro:
            confidence += 0.1

        return min(0.95, confidence)

    def _generate_summary(self, result: PhoenixScore) -> str:
        """Generate a human-readable summary of the assessment."""
        lines = []

        lines.append(f"Phoenix Sepsis Score: {result.total_score}")
        lines.append(f"  - Respiratory: {result.respiratory.score}/3")
        lines.append(f"  - Cardiovascular: {result.cardiovascular.score}/6")
        lines.append(f"  - Coagulation: {result.coagulation.score}/2")
        lines.append(f"  - Neurological: {result.neurological.score}/2")

        if result.meets_septic_shock_criteria:
            lines.append("\n⚠️ MEETS SEPTIC SHOCK CRITERIA")
        elif result.meets_sepsis_criteria:
            lines.append("\n⚠️ MEETS SEPSIS CRITERIA")
        elif not result.suspected_infection:
            lines.append("\nNote: Infection not suspected - sepsis criteria not applicable")

        return "\n".join(lines)
