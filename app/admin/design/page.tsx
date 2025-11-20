/**
 * DESIGN SETTINGS PAGE
 * Admin panel for customizing logos, favicons, and text
 */

'use client';

import { useState, useRef, useEffect } from 'react';

export default function DesignSettings() {
  const [mainLogo, setMainLogo] = useState<string>('');
  const [headerLogo, setHeaderLogo] = useState<string>('');
  const [loginLogo, setLoginLogo] = useState<string>('');
  const [favicon, setFavicon] = useState<string>('');
  const [siteName, setSiteName] = useState<string>('JCIL.ai');
  const [subtitle, setSubtitle] = useState<string>('Your AI Assistant');
  const [modelName, setModelName] = useState<string>('');
  const [isUploading, setIsUploading] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const mainLogoRef = useRef<HTMLInputElement>(null);
  const headerLogoRef = useRef<HTMLInputElement>(null);
  const loginLogoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  // Load current settings from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/design-settings');
        if (response.ok) {
          const settings = await response.json();
          // Don't use /images/logo.png as default since it doesn't exist
          const mainLogoValue = settings.main_logo === '/images/logo.png' ? '' : (settings.main_logo || '');
          setMainLogo(mainLogoValue);
          setHeaderLogo(settings.header_logo || '');
          setLoginLogo(settings.login_logo || '');
          setFavicon(settings.favicon || '');
          setSiteName(settings.site_name || 'JCIL.ai');
          setSubtitle(settings.subtitle || 'Your AI Assistant');
          setModelName(settings.model_name || '');
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleFileUpload = async (file: File, type: string) => {
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(png|jpeg|jpg|ico)$/)) {
      alert('Please upload a PNG, JPEG, or ICO file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setIsUploading(type);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      // Update preview based on type
      switch (type) {
        case 'main-logo':
          setMainLogo(data.url);
          break;
        case 'header-logo':
          setHeaderLogo(data.url);
          break;
        case 'login-logo':
          setLoginLogo(data.url);
          break;
        case 'favicon':
          setFavicon(data.url);
          break;
      }

      setSaveStatus('Uploaded successfully! Click Save Settings to apply changes.');
    } catch (error) {
      alert('Upload failed. Please try again.');
      console.error(error);
    } finally {
      setIsUploading('');
    }
  };

  const handleSaveSettings = async () => {
    setSaveStatus('Saving...');

    try {
      const settings = {
        mainLogo,
        headerLogo,
        loginLogo,
        favicon,
        siteName,
        subtitle,
        modelName,
      };

      // Save to database via API
      const response = await fetch('/api/design-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
      }

      // Dispatch event to notify other components to reload settings
      window.dispatchEvent(new Event('design-settings-updated'));

      setSaveStatus('Settings saved successfully! Changes are now live across your site.');
      setTimeout(() => setSaveStatus(''), 5000);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : 'Failed to save settings');
      console.error(error);
      setTimeout(() => setSaveStatus(''), 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Design Settings</h2>
      <p className="text-gray-400 mb-8">Customize your site&apos;s branding, logos, and text</p>

      {/* Save Status */}
      {saveStatus && (
        <div className={`mb-6 p-4 rounded-lg ${saveStatus.includes('success') ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
          {saveStatus}
        </div>
      )}

      <div className="space-y-8">
        {/* Text Settings */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>✏️</span> Text Settings
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Site Name (Header)
              </label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                placeholder="JCIL.ai"
              />
              <p className="text-xs text-gray-500 mt-1">This appears in the top-left header</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Main Chat Subtitle
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                placeholder="Your AI Assistant"
              />
              <p className="text-xs text-gray-500 mt-1">This appears below the main logo on the chat page</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Model Name
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full bg-black border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                placeholder="Slingshot 2.0"
              />
              <p className="text-xs text-gray-500 mt-1">This appears below the subtitle on the chat page (e.g., &quot;Slingshot 2.0&quot;)</p>
            </div>
          </div>
        </div>

        {/* Main Chat Logo */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🎨</span> Main Chat Logo
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Upload your main logo for the chat page. Recommended: Square image (e.g., 512x512px) - PNG or JPEG
          </p>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Preview */}
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-2">Current Logo Preview:</p>
              <div className="bg-black border border-white/10 rounded-lg p-8 flex items-center justify-center min-h-[200px]">
                {mainLogo ? (
                  <img
                    src={mainLogo}
                    alt="Main Logo"
                    className="h-24 w-auto"
                  />
                ) : (
                  <p className="text-gray-500">No logo uploaded</p>
                )}
              </div>
            </div>

            {/* Upload */}
            <div className="flex-1 flex flex-col justify-center">
              <input
                type="file"
                ref={mainLogoRef}
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, 'main-logo');
                }}
                className="hidden"
              />
              <button
                onClick={() => mainLogoRef.current?.click()}
                disabled={isUploading === 'main-logo'}
                className="bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading === 'main-logo' ? 'Uploading...' : 'Choose Main Logo'}
              </button>
              <p className="text-xs text-gray-500 mt-2">Max size: 2MB</p>
            </div>
          </div>
        </div>

        {/* Header Logo (Top-Left) */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🏷️</span> Header Logo (Top-Left)
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Upload a small square logo for the header. Recommended: 32x32px or 64x64px - PNG
          </p>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Preview */}
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-2">Current Header Logo Preview:</p>
              <div className="bg-black border border-white/10 rounded-lg p-8 flex items-center justify-center min-h-[120px]">
                {headerLogo ? (
                  <img
                    src={headerLogo}
                    alt="Header Logo"
                    className="h-8 w-auto"
                  />
                ) : (
                  <p className="text-gray-500">No logo uploaded</p>
                )}
              </div>
            </div>

            {/* Upload */}
            <div className="flex-1 flex flex-col justify-center">
              <input
                type="file"
                ref={headerLogoRef}
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, 'header-logo');
                }}
                className="hidden"
              />
              <button
                onClick={() => headerLogoRef.current?.click()}
                disabled={isUploading === 'header-logo'}
                className="bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading === 'header-logo' ? 'Uploading...' : 'Choose Header Logo'}
              </button>
              <p className="text-xs text-gray-500 mt-2">Max size: 2MB</p>
            </div>
          </div>
        </div>

        {/* Login Page Logo */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🔐</span> Login Page Logo
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Upload your logo for the login page (centered, middle-top). Recommended: Square image - PNG or JPEG
          </p>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Preview */}
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-2">Current Login Logo Preview:</p>
              <div className="bg-black border border-white/10 rounded-lg p-8 flex items-center justify-center min-h-[200px]">
                {loginLogo ? (
                  <img
                    src={loginLogo}
                    alt="Login Logo"
                    className="h-24 w-auto"
                  />
                ) : (
                  <p className="text-gray-500">No logo uploaded</p>
                )}
              </div>
            </div>

            {/* Upload */}
            <div className="flex-1 flex flex-col justify-center">
              <input
                type="file"
                ref={loginLogoRef}
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, 'login-logo');
                }}
                className="hidden"
              />
              <button
                onClick={() => loginLogoRef.current?.click()}
                disabled={isUploading === 'login-logo'}
                className="bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading === 'login-logo' ? 'Uploading...' : 'Choose Login Logo'}
              </button>
              <p className="text-xs text-gray-500 mt-2">Max size: 2MB</p>
            </div>
          </div>
        </div>

        {/* Favicon */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>⭐</span> Favicon
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Upload your favicon (browser tab icon). Recommended: 32x32px or 64x64px - PNG or ICO
          </p>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Preview */}
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-2">Current Favicon Preview:</p>
              <div className="bg-black border border-white/10 rounded-lg p-8 flex items-center justify-center min-h-[120px]">
                {favicon ? (
                  <img
                    src={favicon}
                    alt="Favicon"
                    className="h-8 w-auto"
                  />
                ) : (
                  <p className="text-gray-500">No favicon uploaded</p>
                )}
              </div>
            </div>

            {/* Upload */}
            <div className="flex-1 flex flex-col justify-center">
              <input
                type="file"
                ref={faviconRef}
                accept="image/png,image/x-icon,image/vnd.microsoft.icon"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, 'favicon');
                }}
                className="hidden"
              />
              <button
                onClick={() => faviconRef.current?.click()}
                disabled={isUploading === 'favicon'}
                className="bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading === 'favicon' ? 'Uploading...' : 'Choose Favicon'}
              </button>
              <p className="text-xs text-gray-500 mt-2">Max size: 2MB</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700 transition"
          >
            Save All Settings
          </button>
        </div>
      </div>
    </div>
  );
}
