/**
 * PHONE VALIDATION TOOL
 *
 * International phone number validation and formatting using libphonenumber-js.
 * Based on Google's libphonenumber - the most comprehensive phone database.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Validate phone numbers for any country
 * - Format numbers in various formats (E.164, national, international)
 * - Extract country and carrier information
 * - Detect phone number type (mobile, landline, toll-free, etc.)
 * - Parse phone numbers from text
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let phoneLib: any = null;

async function initPhoneLib(): Promise<boolean> {
  if (phoneLib) return true;
  try {
    const mod = await import('libphonenumber-js');
    phoneLib = mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const phoneTool: UnifiedTool = {
  name: 'phone_validate',
  description: `Validate, format, and analyze phone numbers using Google's libphonenumber.

Operations:
- validate: Check if a phone number is valid
- format: Format a phone number in various formats
- parse: Parse a phone number and extract all details
- type: Get the type of phone number (mobile, landline, etc.)

Features:
- Supports all countries (250+ regions)
- Detects country from number
- Multiple format outputs (E.164, national, international, RFC3966)
- Phone type detection (mobile, fixed_line, toll_free, premium_rate, etc.)

Use cases:
- User registration validation
- Contact data cleaning
- Phone number formatting for display
- Country detection from phone numbers`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['validate', 'format', 'parse', 'type'],
        description: 'Operation to perform',
      },
      phone_number: {
        type: 'string',
        description: 'Phone number to validate/format (with or without country code)',
      },
      country_code: {
        type: 'string',
        description:
          'ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "DE"). Required if number lacks country code.',
      },
      format: {
        type: 'string',
        enum: ['E164', 'INTERNATIONAL', 'NATIONAL', 'RFC3966'],
        description: 'Output format for formatting operation',
      },
    },
    required: ['operation', 'phone_number'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isPhoneAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executePhone(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args =
    typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;

  const { operation, phone_number, country_code, format = 'INTERNATIONAL' } = args;

  // Initialize library
  const initialized = await initPhoneLib();
  if (!initialized) {
    return {
      toolCallId: toolCall.id,
      content: 'Phone validation library failed to load. Please try again.',
      isError: true,
    };
  }

  try {
    // Parse the phone number
    const parsed = country_code
      ? phoneLib.parsePhoneNumber(phone_number, country_code)
      : phoneLib.parsePhoneNumber(phone_number);

    if (!parsed) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify(
          {
            valid: false,
            error: 'Could not parse phone number. Try providing a country code.',
            input: phone_number,
          },
          null,
          2
        ),
        isError: false,
      };
    }

    let result: Record<string, unknown>;

    switch (operation) {
      case 'validate': {
        const isValid = parsed.isValid();
        const isPossible = parsed.isPossible();

        result = {
          operation: 'validate',
          input: phone_number,
          valid: isValid,
          possible: isPossible,
          country: parsed.country,
          countryCallingCode: parsed.countryCallingCode,
          nationalNumber: parsed.nationalNumber,
          message: isValid
            ? `Valid ${parsed.country} phone number`
            : isPossible
              ? 'Number format is possible but may not be assigned'
              : 'Invalid phone number format',
        };
        break;
      }

      case 'format': {
        const formats: Record<string, string> = {
          E164: parsed.format('E.164'),
          INTERNATIONAL: parsed.format('INTERNATIONAL'),
          NATIONAL: parsed.format('NATIONAL'),
          RFC3966: parsed.format('RFC3966'),
        };

        result = {
          operation: 'format',
          input: phone_number,
          requestedFormat: format,
          formatted: formats[format] || formats.INTERNATIONAL,
          allFormats: formats,
          country: parsed.country,
        };
        break;
      }

      case 'parse': {
        const phoneType = parsed.getType();
        const uri = parsed.getURI();

        result = {
          operation: 'parse',
          input: phone_number,
          valid: parsed.isValid(),
          possible: parsed.isPossible(),
          country: parsed.country,
          countryCallingCode: `+${parsed.countryCallingCode}`,
          nationalNumber: parsed.nationalNumber,
          type: phoneType || 'UNKNOWN',
          typeDescription: getTypeDescription(phoneType),
          formats: {
            e164: parsed.format('E.164'),
            international: parsed.format('INTERNATIONAL'),
            national: parsed.format('NATIONAL'),
            rfc3966: parsed.format('RFC3966'),
          },
          uri,
          carrierInfo: 'Use carrier lookup API for carrier data',
        };
        break;
      }

      case 'type': {
        const phoneType = parsed.getType();

        result = {
          operation: 'type',
          input: phone_number,
          type: phoneType || 'UNKNOWN',
          description: getTypeDescription(phoneType),
          country: parsed.country,
          isMobile: phoneType === 'MOBILE' || phoneType === 'FIXED_LINE_OR_MOBILE',
          isFixedLine: phoneType === 'FIXED_LINE' || phoneType === 'FIXED_LINE_OR_MOBILE',
          isTollFree: phoneType === 'TOLL_FREE',
          isPremiumRate: phoneType === 'PREMIUM_RATE',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result, null, 2),
      isError: false,
    };
  } catch (error) {
    const errorMessage = (error as Error).message;

    // Handle common parsing errors gracefully
    if (errorMessage.includes('NOT_A_NUMBER') || errorMessage.includes('INVALID_COUNTRY')) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify(
          {
            valid: false,
            input: phone_number,
            error: 'Invalid phone number or missing country code',
            suggestion: country_code
              ? 'Check if the number is correct for the specified country'
              : 'Try providing a country_code parameter (e.g., "US", "GB")',
          },
          null,
          2
        ),
        isError: false,
      };
    }

    return {
      toolCallId: toolCall.id,
      content: `Phone validation error: ${errorMessage}`,
      isError: true,
    };
  }
}

// Helper function to get type descriptions
function getTypeDescription(type: string | undefined): string {
  const descriptions: Record<string, string> = {
    MOBILE: 'Mobile phone number',
    FIXED_LINE: 'Landline/fixed-line phone number',
    FIXED_LINE_OR_MOBILE: 'Could be either landline or mobile',
    TOLL_FREE: 'Toll-free number (free to call)',
    PREMIUM_RATE: 'Premium rate number (charges apply)',
    SHARED_COST: 'Shared cost number',
    VOIP: 'VoIP (Voice over IP) number',
    PERSONAL_NUMBER: 'Personal number',
    PAGER: 'Pager number',
    UAN: 'Universal Access Number',
    VOICEMAIL: 'Voicemail access number',
    UNKNOWN: 'Unknown phone number type',
  };
  return descriptions[type || 'UNKNOWN'] || 'Unknown phone number type';
}
