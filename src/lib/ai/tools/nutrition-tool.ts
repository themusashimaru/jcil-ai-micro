/**
 * NUTRITION TOOL
 *
 * Nutritional calculations: macros, calories, BMR, TDEE,
 * meal planning, and dietary analysis.
 *
 * Part of TIER HEALTH - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// BASAL METABOLIC RATE
// ============================================================================

function mifflinStJeor(weight: number, height: number, age: number, male: boolean): number {
  // BMR in kcal/day
  if (male) {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

function harrisBenedict(weight: number, height: number, age: number, male: boolean): number {
  if (male) {
    return 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age;
  }
  return 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
}

function katchMcArdle(leanBodyMass: number): number {
  return 370 + 21.6 * leanBodyMass;
}

// ============================================================================
// TOTAL DAILY ENERGY EXPENDITURE
// ============================================================================

const ACTIVITY_MULTIPLIERS: Record<string, { multiplier: number; description: string }> = {
  sedentary: { multiplier: 1.2, description: 'Little or no exercise' },
  light: { multiplier: 1.375, description: 'Light exercise 1-3 days/week' },
  moderate: { multiplier: 1.55, description: 'Moderate exercise 3-5 days/week' },
  active: { multiplier: 1.725, description: 'Hard exercise 6-7 days/week' },
  very_active: { multiplier: 1.9, description: 'Very hard exercise & physical job' },
};

function calculateTDEE(bmr: number, activityLevel: string): number {
  const activity = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.moderate;
  return bmr * activity.multiplier;
}

// ============================================================================
// BODY COMPOSITION
// ============================================================================

function bodyMassIndex(weight: number, height: number): { bmi: number; category: string } {
  const heightM = height / 100;
  const bmi = weight / (heightM * heightM);

  let category = 'Normal';
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi >= 25 && bmi < 30) category = 'Overweight';
  else if (bmi >= 30) category = 'Obese';

  return { bmi: Math.round(bmi * 10) / 10, category };
}

function idealBodyWeight(height: number, male: boolean): { robinson: number; devine: number; miller: number } {
  const inches = height / 2.54;
  const baseInches = 60;

  if (male) {
    return {
      robinson: 52 + 1.9 * (inches - baseInches),
      devine: 50 + 2.3 * (inches - baseInches),
      miller: 56.2 + 1.41 * (inches - baseInches),
    };
  }
  return {
    robinson: 49 + 1.7 * (inches - baseInches),
    devine: 45.5 + 2.3 * (inches - baseInches),
    miller: 53.1 + 1.36 * (inches - baseInches),
  };
}

function bodyFatEstimate(bmi: number, age: number, male: boolean): number {
  // Deurenberg formula
  if (male) {
    return 1.2 * bmi + 0.23 * age - 16.2;
  }
  return 1.2 * bmi + 0.23 * age - 5.4;
}

// ============================================================================
// MACRONUTRIENT CALCULATIONS
// ============================================================================

function macroSplit(calories: number, proteinPercent: number, carbPercent: number, fatPercent: number): {
  protein: { grams: number; calories: number };
  carbs: { grams: number; calories: number };
  fat: { grams: number; calories: number };
} {
  const proteinCal = calories * proteinPercent / 100;
  const carbCal = calories * carbPercent / 100;
  const fatCal = calories * fatPercent / 100;

  return {
    protein: { grams: Math.round(proteinCal / 4), calories: Math.round(proteinCal) },
    carbs: { grams: Math.round(carbCal / 4), calories: Math.round(carbCal) },
    fat: { grams: Math.round(fatCal / 9), calories: Math.round(fatCal) },
  };
}

function proteinRequirement(weight: number, goal: string): number {
  // g per kg body weight
  const multipliers: Record<string, number> = {
    sedentary: 0.8,
    maintenance: 1.0,
    muscle_gain: 1.6,
    athlete: 2.0,
    weight_loss: 1.2,
  };
  return weight * (multipliers[goal] || 1.0);
}

// ============================================================================
// CALORIE GOALS
// ============================================================================

function calorieGoal(tdee: number, goal: string): { calories: number; deficit_surplus: number } {
  const adjustments: Record<string, number> = {
    aggressive_loss: -1000,
    moderate_loss: -500,
    mild_loss: -250,
    maintain: 0,
    mild_gain: 250,
    moderate_gain: 500,
  };

  const adjustment = adjustments[goal] || 0;
  return {
    calories: Math.round(Math.max(1200, tdee + adjustment)),
    deficit_surplus: adjustment,
  };
}

// ============================================================================
// WATER INTAKE
// ============================================================================

function waterIntake(weight: number, activityLevel: string, climate: string): number {
  // Base: 30-35 ml per kg
  let base = weight * 33;

  if (activityLevel === 'active' || activityLevel === 'very_active') {
    base *= 1.2;
  }
  if (climate === 'hot') {
    base *= 1.2;
  }

  return Math.round(base);
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const nutritionTool: UnifiedTool = {
  name: 'nutrition',
  description: `Nutritional and dietary calculations.

Operations:
- bmr: Calculate Basal Metabolic Rate (Mifflin, Harris-Benedict)
- tdee: Total Daily Energy Expenditure
- bmi: Body Mass Index and ideal weight
- macros: Macronutrient calculations
- calories: Calorie goals for weight management
- hydration: Water intake recommendations`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['bmr', 'tdee', 'bmi', 'macros', 'calories', 'hydration'],
        description: 'Nutrition operation',
      },
      weight: { type: 'number', description: 'Body weight (kg)' },
      height: { type: 'number', description: 'Height (cm)' },
      age: { type: 'number', description: 'Age (years)' },
      male: { type: 'boolean', description: 'Is male (default: true)' },
      activity_level: { type: 'string', enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'], description: 'Activity level' },
      goal: { type: 'string', description: 'Fitness goal (weight_loss, maintenance, muscle_gain)' },
      calories: { type: 'number', description: 'Target calories' },
      protein_percent: { type: 'number', description: 'Protein percentage (%)' },
      carb_percent: { type: 'number', description: 'Carbohydrate percentage (%)' },
      fat_percent: { type: 'number', description: 'Fat percentage (%)' },
      body_fat_percent: { type: 'number', description: 'Body fat percentage' },
      climate: { type: 'string', enum: ['normal', 'hot', 'cold'], description: 'Climate condition' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeNutrition(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'bmr': {
        const { weight = 70, height = 175, age = 30, male = true, body_fat_percent } = args;
        const mifflin = mifflinStJeor(weight, height, age, male);
        const harris = harrisBenedict(weight, height, age, male);

        const bmrResult: Record<string, unknown> = {
          operation: 'bmr',
          inputs: { weight_kg: weight, height_cm: height, age, sex: male ? 'Male' : 'Female' },
          mifflin_st_jeor_kcal: Math.round(mifflin),
          harris_benedict_kcal: Math.round(harris),
          recommended: 'Mifflin-St Jeor (more accurate for modern populations)',
        };

        if (body_fat_percent !== undefined) {
          const lbm = weight * (1 - body_fat_percent / 100);
          const katch = katchMcArdle(lbm);
          bmrResult.katch_mcardle_kcal = Math.round(katch);
          bmrResult.lean_body_mass_kg = Math.round(lbm * 10) / 10;
          bmrResult.note = 'Katch-McArdle uses lean body mass for more accuracy';
        }

        result = bmrResult;
        break;
      }

      case 'tdee': {
        const { weight = 70, height = 175, age = 30, male = true, activity_level = 'moderate' } = args;
        const bmr = mifflinStJeor(weight, height, age, male);
        const tdee = calculateTDEE(bmr, activity_level);
        const activity = ACTIVITY_MULTIPLIERS[activity_level] || ACTIVITY_MULTIPLIERS.moderate;

        result = {
          operation: 'tdee',
          inputs: { weight_kg: weight, height_cm: height, age, sex: male ? 'Male' : 'Female' },
          bmr_kcal: Math.round(bmr),
          activity_level: activity_level,
          activity_description: activity.description,
          activity_multiplier: activity.multiplier,
          tdee_kcal: Math.round(tdee),
          all_activity_levels: Object.entries(ACTIVITY_MULTIPLIERS).map(([level, info]) => ({
            level,
            description: info.description,
            tdee: Math.round(bmr * info.multiplier),
          })),
        };
        break;
      }

      case 'bmi': {
        const { weight = 70, height = 175, age = 30, male = true } = args;
        const { bmi, category } = bodyMassIndex(weight, height);
        const ibw = idealBodyWeight(height, male);
        const bodyFat = bodyFatEstimate(bmi, age, male);

        result = {
          operation: 'bmi',
          inputs: { weight_kg: weight, height_cm: height },
          bmi: bmi,
          bmi_category: category,
          healthy_bmi_range: '18.5 - 24.9',
          ideal_body_weight_kg: {
            robinson: Math.round(ibw.robinson),
            devine: Math.round(ibw.devine),
            miller: Math.round(ibw.miller),
          },
          estimated_body_fat_percent: Math.round(bodyFat * 10) / 10,
          healthy_body_fat_range: male ? '10-20%' : '18-28%',
        };
        break;
      }

      case 'macros': {
        const { calories = 2000, protein_percent = 30, carb_percent = 40, fat_percent = 30, weight = 70, goal = 'maintenance' } = args;

        const total = protein_percent + carb_percent + fat_percent;
        if (Math.abs(total - 100) > 1) {
          throw new Error(`Macro percentages must sum to 100 (current: ${total})`);
        }

        const macros = macroSplit(calories, protein_percent, carb_percent, fat_percent);
        const proteinReq = proteinRequirement(weight, goal);

        result = {
          operation: 'macros',
          target_calories: calories,
          macro_split: {
            protein: `${protein_percent}%`,
            carbs: `${carb_percent}%`,
            fat: `${fat_percent}%`,
          },
          daily_targets: {
            protein: { grams: macros.protein.grams, calories: macros.protein.calories },
            carbohydrates: { grams: macros.carbs.grams, calories: macros.carbs.calories },
            fat: { grams: macros.fat.grams, calories: macros.fat.calories },
          },
          protein_per_kg: Math.round(macros.protein.grams / weight * 10) / 10,
          recommended_protein_g: Math.round(proteinReq),
          protein_adequate: macros.protein.grams >= proteinReq * 0.9,
        };
        break;
      }

      case 'calories': {
        const { weight = 70, height = 175, age = 30, male = true, activity_level = 'moderate', goal = 'maintain' } = args;
        const bmr = mifflinStJeor(weight, height, age, male);
        const tdee = calculateTDEE(bmr, activity_level);

        const goals = ['aggressive_loss', 'moderate_loss', 'mild_loss', 'maintain', 'mild_gain', 'moderate_gain'];
        const goalCalories = goals.map(g => {
          const { calories, deficit_surplus } = calorieGoal(tdee, g);
          return {
            goal: g.replace('_', ' '),
            calories,
            adjustment: deficit_surplus,
            weekly_change_kg: Math.round(deficit_surplus * 7 / 7700 * 100) / 100,
          };
        });

        const selected = calorieGoal(tdee, goal);

        result = {
          operation: 'calories',
          maintenance_tdee: Math.round(tdee),
          selected_goal: goal,
          target_calories: selected.calories,
          daily_adjustment: selected.deficit_surplus,
          all_goals: goalCalories,
          note: '7700 kcal ≈ 1 kg body weight change',
        };
        break;
      }

      case 'hydration': {
        const { weight = 70, activity_level = 'moderate', climate = 'normal' } = args;
        const water = waterIntake(weight, activity_level, climate);

        result = {
          operation: 'hydration',
          body_weight_kg: weight,
          activity_level: activity_level,
          climate: climate,
          daily_water_intake: {
            ml: water,
            liters: Math.round(water / 100) / 10,
            cups_250ml: Math.round(water / 250),
            oz: Math.round(water / 29.57),
          },
          timing_suggestion: {
            on_waking: '500 ml',
            with_meals: '250 ml × 3',
            between_meals: '250 ml × 4',
            during_exercise: '500-1000 ml/hour',
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Nutrition Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isNutritionAvailable(): boolean { return true; }
