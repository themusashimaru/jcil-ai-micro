'use client';

import { useState, useEffect } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import {
  supportsPasskeys,
  getBiometricName,
  authenticateWithPasskey,
} from '@/lib/auth/webauthn-client';

interface PasskeyLoginButtonProps {
  email?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function PasskeyLoginButton({
  email,
  onSuccess,
  onError,
  className = '',
}: PasskeyLoginButtonProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [biometricName, setBiometricName] = useState('Passkey');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSupport, setIsCheckingSupport] = useState(true);

  useEffect(() => {
    async function checkSupport() {
      const supported = await supportsPasskeys();
      setIsSupported(supported);
      if (supported) {
        setBiometricName(getBiometricName());
      }
      setIsCheckingSupport(false);
    }
    checkSupport();
  }, []);

  const handleClick = async () => {
    setIsLoading(true);

    const result = await authenticateWithPasskey(email);

    if (result.success) {
      if (result.redirectUrl) {
        // Redirect to complete sign-in
        window.location.href = result.redirectUrl;
      } else {
        onSuccess?.();
      }
    } else {
      setIsLoading(false);
      onError?.(result.error || 'Authentication failed');
    }
  };

  // Don't render if not supported or still checking
  if (isCheckingSupport || !isSupported) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Authenticating...</span>
        </>
      ) : (
        <>
          <Fingerprint className="h-5 w-5" />
          <span>Sign in with {biometricName}</span>
        </>
      )}
    </button>
  );
}
