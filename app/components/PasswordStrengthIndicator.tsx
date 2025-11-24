/**
 * PASSWORD STRENGTH INDICATOR COMPONENT
 *
 * PURPOSE:
 * - Visual feedback for password strength
 * - Show password match status
 * - Color-coded strength bar (red/yellow/green)
 * - Display password requirements
 */

'use client';

interface PasswordStrengthIndicatorProps {
  password: string;
  confirmPassword?: string;
  showMatchStatus?: boolean;
}

interface StrengthResult {
  score: number; // 0-4
  label: string;
  color: string;
  bgColor: string;
  percentage: number;
}

export default function PasswordStrengthIndicator({
  password,
  confirmPassword,
  showMatchStatus = false,
}: PasswordStrengthIndicatorProps) {
  // Calculate password strength
  const calculateStrength = (pwd: string): StrengthResult => {
    if (!pwd) {
      return {
        score: 0,
        label: 'No password',
        color: 'text-gray-400',
        bgColor: 'bg-gray-600',
        percentage: 0,
      };
    }

    let score = 0;
    const checks = {
      length: pwd.length >= 8,
      hasLower: /[a-z]/.test(pwd),
      hasUpper: /[A-Z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[^A-Za-z0-9]/.test(pwd),
    };

    // Scoring
    if (checks.length) score++;
    if (checks.hasLower && checks.hasUpper) score++;
    if (checks.hasNumber) score++;
    if (checks.hasSpecial) score++;

    // Determine label and color based on score
    if (score === 0 || !checks.length) {
      return {
        score: 0,
        label: 'Too short',
        color: 'text-red-400',
        bgColor: 'bg-red-500',
        percentage: 25,
      };
    } else if (score === 1) {
      return {
        score: 1,
        label: 'Weak',
        color: 'text-red-400',
        bgColor: 'bg-red-500',
        percentage: 25,
      };
    } else if (score === 2) {
      return {
        score: 2,
        label: 'Fair',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500',
        percentage: 50,
      };
    } else if (score === 3) {
      return {
        score: 3,
        label: 'Good',
        color: 'text-green-400',
        bgColor: 'bg-green-500',
        percentage: 75,
      };
    } else {
      return {
        score: 4,
        label: 'Strong',
        color: 'text-green-400',
        bgColor: 'bg-green-500',
        percentage: 100,
      };
    }
  };

  const strength = calculateStrength(password);
  const passwordsMatch = confirmPassword !== undefined && password === confirmPassword && password.length > 0;
  const passwordsDontMatch = confirmPassword !== undefined && confirmPassword.length > 0 && password !== confirmPassword;

  // Don't show anything if no password
  if (!password) return null;

  return (
    <div className="space-y-2">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${strength.bgColor} transition-all duration-300`}
            style={{ width: `${strength.percentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={`font-medium ${strength.color}`}>
            {strength.label}
          </span>
          {showMatchStatus && confirmPassword !== undefined && (
            <>
              {passwordsMatch && (
                <span className="text-green-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Passwords match
                </span>
              )}
              {passwordsDontMatch && (
                <span className="text-red-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Passwords don&apos;t match
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Password Requirements (only show for weak passwords) */}
      {strength.score < 3 && (
        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-medium">Password requirements:</p>
          <ul className="space-y-0.5 ml-3">
            <li className={password.length >= 8 ? 'text-green-400' : 'text-gray-500'}>
              • At least 8 characters
            </li>
            <li className={/[a-z]/.test(password) && /[A-Z]/.test(password) ? 'text-green-400' : 'text-gray-500'}>
              • Uppercase and lowercase letters
            </li>
            <li className={/[0-9]/.test(password) ? 'text-green-400' : 'text-gray-500'}>
              • At least one number
            </li>
            <li className={/[^A-Za-z0-9]/.test(password) ? 'text-green-400' : 'text-gray-500'}>
              • Special character (!, @, #, etc.)
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
