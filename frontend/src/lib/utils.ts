/**
 * Shared utility functions for EPCID app
 * CRITICAL: Use these utilities for consistent calculations across the app
 */

/**
 * Calculate age from date of birth
 * This is the SINGLE SOURCE OF TRUTH for age calculation
 * Accounts for birth month and day, not just year difference
 */
export function calculateAge(dateOfBirth: string | Date): number {
  const today = new Date()
  const birth = new Date(dateOfBirth)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  
  // Adjust if birthday hasn't occurred this year yet
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  
  return Math.max(0, age) // Never return negative age
}

/**
 * Calculate age in months (for infants under 2 years)
 */
export function calculateAgeInMonths(dateOfBirth: string | Date): number {
  const today = new Date()
  const birth = new Date(dateOfBirth)
  
  let months = (today.getFullYear() - birth.getFullYear()) * 12
  months += today.getMonth() - birth.getMonth()
  
  if (today.getDate() < birth.getDate()) {
    months--
  }
  
  return Math.max(0, months)
}

/**
 * Format age for display (handles infants differently)
 */
export function formatAge(dateOfBirth: string | Date): string {
  const months = calculateAgeInMonths(dateOfBirth)
  
  if (months < 24) {
    return `${months} months old`
  }
  
  return `${calculateAge(dateOfBirth)} years old`
}

/**
 * Calculate safe medication dosage based on weight
 * Uses standard pediatric dosing guidelines
 */
export function calculateDosage(
  weightLbs: number, 
  medicationType: 'acetaminophen' | 'ibuprofen'
): { dose_mg: number; max_daily_mg: number; frequency: string } {
  const weightKg = weightLbs * 0.453592
  
  if (medicationType === 'acetaminophen') {
    // 10-15 mg/kg per dose, max 5 doses/day
    const dose = Math.round(weightKg * 12.5) // Use middle of range
    return {
      dose_mg: Math.min(dose, 1000), // Max single dose 1000mg for older children
      max_daily_mg: Math.min(dose * 5, 4000), // Max 4000mg/day
      frequency: 'every 4-6 hours'
    }
  } else {
    // Ibuprofen: 5-10 mg/kg per dose
    const dose = Math.round(weightKg * 7.5) // Use middle of range
    return {
      dose_mg: Math.min(dose, 400), // Max single dose 400mg
      max_daily_mg: Math.min(dose * 4, 1200), // Max 1200mg/day (40mg/kg)
      frequency: 'every 6-8 hours'
    }
  }
}

/**
 * Calculate recommended fluid intake based on weight
 */
export function calculateFluidIntake(weightLbs: number): { oz_per_hour: number; ml_per_day: number } {
  const weightKg = weightLbs * 0.453592
  
  // Holliday-Segar method for maintenance fluids
  let ml_per_day: number
  if (weightKg <= 10) {
    ml_per_day = weightKg * 100
  } else if (weightKg <= 20) {
    ml_per_day = 1000 + (weightKg - 10) * 50
  } else {
    ml_per_day = 1500 + (weightKg - 20) * 20
  }
  
  // During illness, increase by 50%
  ml_per_day = ml_per_day * 1.5
  
  const oz_per_day = ml_per_day / 29.5735
  const oz_per_hour = Math.round(oz_per_day / 16) // Waking hours
  
  return { oz_per_hour, ml_per_day: Math.round(ml_per_day) }
}

/**
 * Determine fever severity based on age and temperature
 */
export function classifyFever(
  tempF: number, 
  ageMonths: number
): { severity: 'normal' | 'low_grade' | 'moderate' | 'high' | 'critical'; message: string } {
  if (tempF < 100.4) {
    return { severity: 'normal', message: 'Temperature is within normal range' }
  }
  
  // Infants under 3 months - any fever is concerning
  if (ageMonths < 3 && tempF >= 100.4) {
    return { 
      severity: 'critical', 
      message: 'Fever in infant under 3 months requires immediate medical attention' 
    }
  }
  
  if (tempF >= 104) {
    return { severity: 'critical', message: 'High fever - seek medical care' }
  }
  
  if (tempF >= 102) {
    return { severity: 'high', message: 'Moderate-high fever - monitor closely' }
  }
  
  if (tempF >= 100.4) {
    return { severity: 'low_grade', message: 'Low-grade fever - monitor symptoms' }
  }
  
  return { severity: 'normal', message: 'Temperature is normal' }
}
