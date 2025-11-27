'use client';

import { useState, useEffect } from 'react';
import { Fingerprint, Trash2, Plus, Loader2, Smartphone } from 'lucide-react';
import {
  supportsPasskeys,
  getBiometricName,
  registerPasskey,
  getPasskeys,
  deletePasskey,
} from '@/lib/auth/webauthn-client';

interface Passkey {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
}

export default function PasskeySettings() {
  const [isSupported, setIsSupported] = useState(false);
  const [biometricName, setBiometricName] = useState('Passkey');
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const supported = await supportsPasskeys();
      setIsSupported(supported);
      if (supported) {
        setBiometricName(getBiometricName());
      }
      await loadPasskeys();
    }
    init();
  }, []);

  const loadPasskeys = async () => {
    setIsLoading(true);
    const result = await getPasskeys();
    setPasskeys(result.passkeys);
    setIsLoading(false);
  };

  const handleAdd = async () => {
    setIsAdding(true);
    setError(null);
    setSuccess(null);

    const result = await registerPasskey();

    if (result.success) {
      setSuccess(`${biometricName} added successfully!`);
      await loadPasskeys();
    } else {
      setError(result.error || 'Failed to add passkey');
    }

    setIsAdding(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);

    const result = await deletePasskey(id);

    if (result.success) {
      setPasskeys(passkeys.filter((p) => p.id !== id));
    } else {
      setError(result.error || 'Failed to remove passkey');
    }

    setDeletingId(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!isSupported) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3 text-gray-400">
          <Fingerprint className="h-5 w-5" />
          <div>
            <p className="text-sm font-medium">Biometric Login Not Available</p>
            <p className="text-xs text-gray-500">
              Your device doesn&apos;t support Face ID, Touch ID, or Windows Hello
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
            <Fingerprint className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">{biometricName}</h3>
            <p className="text-xs text-gray-500">Sign in faster with biometrics</p>
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={isAdding}
          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {isAdding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Add {biometricName}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg bg-red-500/20 p-3 text-xs text-red-300">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-500/20 p-3 text-xs text-green-300">{success}</div>
      )}

      {/* Passkeys List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : passkeys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
          <Smartphone className="mx-auto h-8 w-8 text-gray-500" />
          <p className="mt-2 text-sm text-gray-400">No passkeys registered</p>
          <p className="text-xs text-gray-500">
            Add {biometricName} for faster, more secure sign-in
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {passkeys.map((passkey) => (
            <div
              key={passkey.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-white">{passkey.device_name}</p>
                  <p className="text-xs text-gray-500">
                    Added {formatDate(passkey.created_at)}
                    {passkey.last_used_at && ` · Last used ${formatDate(passkey.last_used_at)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(passkey.id)}
                disabled={deletingId === passkey.id}
                className="rounded-lg p-2 text-gray-400 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                title="Remove passkey"
              >
                {deletingId === passkey.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-gray-500">
        Passkeys use your device&apos;s built-in security (Face ID, Touch ID, or Windows Hello)
        for passwordless sign-in. Your biometric data never leaves your device.
      </p>
    </div>
  );
}
