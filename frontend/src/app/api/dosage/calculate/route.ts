/**
 * Server-side Dosage Calculator API Route
 * 
 * Calculates safe medication dosages based on:
 * - Child's weight (in lbs or kg)
 * - Age
 * - Medication type
 * 
 * Includes safety checks and contraindication warnings.
 */

import { NextRequest, NextResponse } from 'next/server'

// Medication dosing tables (evidence-based)
const MEDICATION_DATA: Record<string, MedicationInfo> = {
  acetaminophen: {
    name: 'Acetaminophen (Tylenol)',
    dosePerKg: 15, // mg/kg
    maxSingleDose: 1000, // mg
    maxDailyDose: 75, // mg/kg/day
    maxAbsoluteDaily: 4000, // mg
    frequency: 'Every 4-6 hours',
    minAge: 0,
    forms: [
      { name: 'Infant Drops (80mg/0.8mL)', concentration: 100 }, // mg/mL
      { name: 'Children\'s Liquid (160mg/5mL)', concentration: 32 },
      { name: 'Children\'s Chewables (160mg)', concentration: 160 },
      { name: 'Junior Strength (325mg)', concentration: 325 },
    ],
    warnings: [
      'Do not use with other acetaminophen-containing products',
      'Check all medications for acetaminophen content',
      'Liver damage can occur with overdose',
    ],
    contraindications: ['Liver disease', 'Alcohol use (adults)'],
  },
  ibuprofen: {
    name: 'Ibuprofen (Advil/Motrin)',
    dosePerKg: 10, // mg/kg
    maxSingleDose: 400, // mg
    maxDailyDose: 40, // mg/kg/day
    maxAbsoluteDaily: 1200, // mg
    frequency: 'Every 6-8 hours',
    minAge: 0.5, // 6 months
    forms: [
      { name: 'Infant Drops (50mg/1.25mL)', concentration: 40 },
      { name: 'Children\'s Liquid (100mg/5mL)', concentration: 20 },
      { name: 'Children\'s Chewables (100mg)', concentration: 100 },
      { name: 'Junior Strength (100mg)', concentration: 100 },
    ],
    warnings: [
      'Give with food to reduce stomach upset',
      'Not recommended for children under 6 months',
      'Avoid if child has kidney problems or is dehydrated',
    ],
    contraindications: [
      'Age under 6 months',
      'Kidney disease',
      'Bleeding disorders',
      'Aspirin allergy',
      'Dehydration',
      'Chickenpox or flu (risk of Reye\'s syndrome)',
    ],
  },
  diphenhydramine: {
    name: 'Diphenhydramine (Benadryl)',
    dosePerKg: 1.25, // mg/kg
    maxSingleDose: 50, // mg
    maxDailyDose: 5, // mg/kg/day
    maxAbsoluteDaily: 300, // mg
    frequency: 'Every 6 hours',
    minAge: 2,
    forms: [
      { name: 'Children\'s Liquid (12.5mg/5mL)', concentration: 2.5 },
      { name: 'Chewables (12.5mg)', concentration: 12.5 },
      { name: 'Tablets (25mg)', concentration: 25 },
    ],
    warnings: [
      'May cause drowsiness',
      'Not recommended for children under 2 years',
      'Do not use to make children sleepy',
    ],
    contraindications: ['Age under 2 years', 'Glaucoma', 'Urinary problems'],
  },
}

interface MedicationInfo {
  name: string
  dosePerKg: number
  maxSingleDose: number
  maxDailyDose: number
  maxAbsoluteDaily: number
  frequency: string
  minAge: number
  forms: Array<{ name: string; concentration: number }>
  warnings: string[]
  contraindications: string[]
}

interface DosageRequest {
  medication: string
  weightLbs?: number
  weightKg?: number
  ageYears: number
  medicalConditions?: string[]
}

interface DosageResponse {
  medication: string
  recommendedDose: {
    mg: number
    description: string
  }
  byForm: Array<{
    form: string
    amount: string
  }>
  frequency: string
  maxDailyDose: string
  warnings: string[]
  contraindications: string[]
  isContraindicated: boolean
  contraindicationReason?: string
  disclaimer: string
  requestId: string
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    const body: DosageRequest = await request.json()

    // Validate required fields
    if (!body.medication || (!body.weightLbs && !body.weightKg) || body.ageYears === undefined) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'medication, weight (weightLbs or weightKg), and ageYears are required.',
        },
        { status: 400, headers: { 'X-Request-ID': requestId } }
      )
    }

    // Normalize medication name
    const medKey = body.medication.toLowerCase().replace(/[^a-z]/g, '')
    const medInfo = MEDICATION_DATA[medKey]

    if (!medInfo) {
      return NextResponse.json(
        {
          error: 'NOT_FOUND',
          message: `Medication "${body.medication}" not found. Supported medications: ${Object.keys(MEDICATION_DATA).join(', ')}`,
          supportedMedications: Object.keys(MEDICATION_DATA),
        },
        { status: 404, headers: { 'X-Request-ID': requestId } }
      )
    }

    // Convert weight to kg
    const weightKg = body.weightKg || (body.weightLbs! * 0.453592)

    // Check age contraindication
    if (body.ageYears < medInfo.minAge) {
      return NextResponse.json<DosageResponse>(
        {
          medication: medInfo.name,
          recommendedDose: { mg: 0, description: 'NOT RECOMMENDED' },
          byForm: [],
          frequency: medInfo.frequency,
          maxDailyDose: 'N/A',
          warnings: medInfo.warnings,
          contraindications: medInfo.contraindications,
          isContraindicated: true,
          contraindicationReason: `${medInfo.name} is not recommended for children under ${medInfo.minAge === 0.5 ? '6 months' : `${medInfo.minAge} years`}. Please consult your pediatrician for alternatives.`,
          disclaimer: 'Always consult your pediatrician or pharmacist before giving any medication to your child.',
          requestId,
        },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }

    // Check medical conditions for contraindications
    let isContraindicated = false
    let contraindicationReason = ''
    if (body.medicalConditions?.length) {
      for (const condition of body.medicalConditions) {
        const conditionLower = condition.toLowerCase()
        for (const contraindication of medInfo.contraindications) {
          if (contraindication.toLowerCase().includes(conditionLower) ||
              conditionLower.includes(contraindication.toLowerCase())) {
            isContraindicated = true
            contraindicationReason = `${medInfo.name} may not be safe with ${condition}. Please consult your pediatrician.`
            break
          }
        }
        if (isContraindicated) break
      }
    }

    // Calculate dose
    let doseMg = weightKg * medInfo.dosePerKg
    
    // Apply maximum single dose limit
    if (doseMg > medInfo.maxSingleDose) {
      doseMg = medInfo.maxSingleDose
    }

    // Round to reasonable precision
    doseMg = Math.round(doseMg)

    // Calculate max daily dose
    let maxDaily = weightKg * medInfo.maxDailyDose
    if (maxDaily > medInfo.maxAbsoluteDaily) {
      maxDaily = medInfo.maxAbsoluteDaily
    }

    // Calculate amounts for each form
    const byForm = medInfo.forms.map(form => {
      const amount = doseMg / form.concentration
      let amountStr: string
      
      if (form.name.includes('Liquid') || form.name.includes('Drops')) {
        amountStr = `${amount.toFixed(1)} mL`
      } else if (form.name.includes('Chewable') || form.name.includes('Tablet')) {
        if (amount >= 1) {
          amountStr = `${Math.round(amount)} tablet(s)`
        } else {
          amountStr = `${Math.round(amount * 2) / 2} tablet` // Round to nearest half
        }
      } else {
        amountStr = `${amount.toFixed(1)} unit(s)`
      }

      return {
        form: form.name,
        amount: amountStr,
      }
    })

    return NextResponse.json<DosageResponse>(
      {
        medication: medInfo.name,
        recommendedDose: {
          mg: doseMg,
          description: `${doseMg}mg (based on ${weightKg.toFixed(1)}kg body weight)`,
        },
        byForm,
        frequency: medInfo.frequency,
        maxDailyDose: `${Math.round(maxDaily)}mg per day`,
        warnings: medInfo.warnings,
        contraindications: medInfo.contraindications,
        isContraindicated,
        contraindicationReason: isContraindicated ? contraindicationReason : undefined,
        disclaimer: '⚠️ IMPORTANT: Always verify dosing with your pediatrician or pharmacist. This calculator provides general guidance only and should not replace professional medical advice.',
        requestId,
      },
      { status: 200, headers: { 'X-Request-ID': requestId } }
    )

  } catch (error) {
    console.error(`[${requestId}] Dosage calculation error:`, error)
    
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Unable to calculate dosage. Please consult your pediatrician or pharmacist.',
        requestId,
      },
      { status: 500, headers: { 'X-Request-ID': requestId } }
    )
  }
}

// GET endpoint to list supported medications
export async function GET() {
  return NextResponse.json({
    supportedMedications: Object.entries(MEDICATION_DATA).map(([key, info]) => ({
      id: key,
      name: info.name,
      minAge: info.minAge,
      frequency: info.frequency,
    })),
    disclaimer: 'Always consult your pediatrician or pharmacist before giving any medication to your child.',
  })
}
