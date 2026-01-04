/**
 * AUTH TEMPLATE GENERATOR
 *
 * FORGE ONE-CLICK AUTH SYSTEM
 *
 * PURPOSE:
 * - Generate authentication pages for user websites
 * - Supabase Auth integration
 * - Matching styling with generated sites
 */

export interface AuthConfig {
  businessName: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  features?: {
    emailPassword?: boolean;
    googleOAuth?: boolean;
    githubOAuth?: boolean;
    magicLink?: boolean;
    passkey?: boolean;
  };
}

/**
 * Generate a complete login page HTML
 */
export function generateLoginPage(config: AuthConfig): string {
  const {
    businessName,
    primaryColor = '#8b5cf6',
    secondaryColor = '#06b6d4',
    logoUrl,
    features = { emailPassword: true, googleOAuth: true },
  } = config;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - ${businessName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-container {
      width: 100%;
      max-width: 420px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 40px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo img {
      height: 60px;
      width: auto;
    }
    .logo-text {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    h1 {
      color: white;
      font-size: 24px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #94a3b8;
      text-align: center;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 8px;
    }
    input[type="email"],
    input[type="password"] {
      width: 100%;
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: white;
      font-size: 16px;
      transition: all 0.2s;
    }
    input:focus {
      outline: none;
      border-color: ${primaryColor};
      box-shadow: 0 0 0 3px ${primaryColor}33;
    }
    input::placeholder {
      color: #64748b;
    }
    .btn-primary {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 10px;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px ${primaryColor}40;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .divider {
      display: flex;
      align-items: center;
      margin: 25px 0;
      color: #64748b;
      font-size: 14px;
    }
    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
    }
    .divider span {
      padding: 0 15px;
    }
    .oauth-buttons {
      display: flex;
      gap: 12px;
    }
    .btn-oauth {
      flex: 1;
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-oauth:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .signup-link {
      text-align: center;
      margin-top: 25px;
      color: #94a3b8;
      font-size: 14px;
    }
    .signup-link a {
      color: ${primaryColor};
      text-decoration: none;
      font-weight: 500;
    }
    .signup-link a:hover {
      text-decoration: underline;
    }
    .error-message {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
      display: none;
    }
    .success-message {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #4ade80;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
      display: none;
    }
    .forgot-password {
      text-align: right;
      margin-top: 8px;
    }
    .forgot-password a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 13px;
    }
    .forgot-password a:hover {
      color: ${primaryColor};
    }
    @media (max-width: 480px) {
      .login-container {
        padding: 30px 20px;
      }
      .oauth-buttons {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="logo">
      ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}">` : `<div class="logo-text">${businessName}</div>`}
    </div>

    <h1>Welcome back</h1>
    <p class="subtitle">Sign in to your account to continue</p>

    <div id="error-message" class="error-message"></div>
    <div id="success-message" class="success-message"></div>

    <form id="login-form">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" placeholder="Enter your email" required>
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" placeholder="Enter your password" required>
        <div class="forgot-password">
          <a href="forgot-password.html">Forgot password?</a>
        </div>
      </div>
      <button type="submit" class="btn-primary" id="login-btn">Sign In</button>
    </form>

    ${features.googleOAuth || features.githubOAuth ? `
    <div class="divider"><span>or continue with</span></div>
    <div class="oauth-buttons">
      ${features.googleOAuth ? `
      <button type="button" class="btn-oauth" id="google-btn">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Google
      </button>
      ` : ''}
      ${features.githubOAuth ? `
      <button type="button" class="btn-oauth" id="github-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        GitHub
      </button>
      ` : ''}
    </div>
    ` : ''}

    <p class="signup-link">
      Don't have an account? <a href="signup.html">Sign up</a>
    </p>
  </div>

  <script>
    // Initialize Supabase - Replace with your credentials
    const SUPABASE_URL = 'YOUR_SUPABASE_URL';
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
      successMessage.style.display = 'none';
    }

    function showSuccess(message) {
      successMessage.textContent = message;
      successMessage.style.display = 'block';
      errorMessage.style.display = 'none';
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginBtn.disabled = true;
      loginBtn.textContent = 'Signing in...';

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        showSuccess('Login successful! Redirecting...');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 1000);
      } catch (error) {
        showError(error.message || 'Login failed. Please try again.');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
      }
    });

    ${features.googleOAuth ? `
    document.getElementById('google-btn').addEventListener('click', async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/auth-callback.html'
        }
      });
      if (error) showError(error.message);
    });
    ` : ''}

    ${features.githubOAuth ? `
    document.getElementById('github-btn').addEventListener('click', async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin + '/auth-callback.html'
        }
      });
      if (error) showError(error.message);
    });
    ` : ''}

    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = '/dashboard.html';
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Generate a complete signup page HTML
 */
export function generateSignupPage(config: AuthConfig): string {
  const {
    businessName,
    primaryColor = '#8b5cf6',
    secondaryColor = '#06b6d4',
    logoUrl,
  } = config;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign Up - ${businessName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .signup-container {
      width: 100%;
      max-width: 420px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 40px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo img {
      height: 60px;
      width: auto;
    }
    .logo-text {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    h1 {
      color: white;
      font-size: 24px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #94a3b8;
      text-align: center;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-row {
      display: flex;
      gap: 12px;
    }
    .form-row .form-group {
      flex: 1;
    }
    label {
      display: block;
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 8px;
    }
    input[type="text"],
    input[type="email"],
    input[type="password"] {
      width: 100%;
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: white;
      font-size: 16px;
      transition: all 0.2s;
    }
    input:focus {
      outline: none;
      border-color: ${primaryColor};
      box-shadow: 0 0 0 3px ${primaryColor}33;
    }
    input::placeholder {
      color: #64748b;
    }
    .btn-primary {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 10px;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px ${primaryColor}40;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .login-link {
      text-align: center;
      margin-top: 25px;
      color: #94a3b8;
      font-size: 14px;
    }
    .login-link a {
      color: ${primaryColor};
      text-decoration: none;
      font-weight: 500;
    }
    .login-link a:hover {
      text-decoration: underline;
    }
    .error-message {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
      display: none;
    }
    .success-message {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #4ade80;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
      display: none;
    }
    .password-strength {
      margin-top: 8px;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    .password-strength-bar {
      height: 100%;
      width: 0%;
      transition: all 0.3s;
    }
    .password-strength-bar.weak { width: 33%; background: #ef4444; }
    .password-strength-bar.medium { width: 66%; background: #f59e0b; }
    .password-strength-bar.strong { width: 100%; background: #22c55e; }
    .terms {
      font-size: 12px;
      color: #64748b;
      margin-top: 20px;
      text-align: center;
    }
    .terms a {
      color: ${primaryColor};
      text-decoration: none;
    }
    @media (max-width: 480px) {
      .signup-container {
        padding: 30px 20px;
      }
      .form-row {
        flex-direction: column;
        gap: 0;
      }
    }
  </style>
</head>
<body>
  <div class="signup-container">
    <div class="logo">
      ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}">` : `<div class="logo-text">${businessName}</div>`}
    </div>

    <h1>Create an account</h1>
    <p class="subtitle">Join ${businessName} today</p>

    <div id="error-message" class="error-message"></div>
    <div id="success-message" class="success-message"></div>

    <form id="signup-form">
      <div class="form-row">
        <div class="form-group">
          <label for="firstName">First Name</label>
          <input type="text" id="firstName" name="firstName" placeholder="John" required>
        </div>
        <div class="form-group">
          <label for="lastName">Last Name</label>
          <input type="text" id="lastName" name="lastName" placeholder="Doe" required>
        </div>
      </div>
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" placeholder="john@example.com" required>
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" placeholder="Create a strong password" required minlength="8">
        <div class="password-strength">
          <div id="password-strength-bar" class="password-strength-bar"></div>
        </div>
      </div>
      <div class="form-group">
        <label for="confirmPassword">Confirm Password</label>
        <input type="password" id="confirmPassword" name="confirmPassword" placeholder="Confirm your password" required>
      </div>
      <button type="submit" class="btn-primary" id="signup-btn">Create Account</button>
    </form>

    <p class="terms">
      By signing up, you agree to our <a href="terms.html">Terms of Service</a> and <a href="privacy.html">Privacy Policy</a>
    </p>

    <p class="login-link">
      Already have an account? <a href="login.html">Sign in</a>
    </p>
  </div>

  <script>
    // Initialize Supabase - Replace with your credentials
    const SUPABASE_URL = 'YOUR_SUPABASE_URL';
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const signupForm = document.getElementById('signup-form');
    const signupBtn = document.getElementById('signup-btn');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    const passwordInput = document.getElementById('password');
    const strengthBar = document.getElementById('password-strength-bar');

    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
      successMessage.style.display = 'none';
    }

    function showSuccess(message) {
      successMessage.textContent = message;
      successMessage.style.display = 'block';
      errorMessage.style.display = 'none';
    }

    function checkPasswordStrength(password) {
      if (password.length < 6) {
        strengthBar.className = 'password-strength-bar';
        return;
      }
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
      const score = [hasUpper, hasLower, hasNumber, hasSpecial, password.length >= 8].filter(Boolean).length;

      if (score <= 2) strengthBar.className = 'password-strength-bar weak';
      else if (score <= 3) strengthBar.className = 'password-strength-bar medium';
      else strengthBar.className = 'password-strength-bar strong';
    }

    passwordInput.addEventListener('input', (e) => checkPasswordStrength(e.target.value));

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      signupBtn.disabled = true;
      signupBtn.textContent = 'Creating account...';

      const firstName = document.getElementById('firstName').value;
      const lastName = document.getElementById('lastName').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (password !== confirmPassword) {
        showError('Passwords do not match');
        signupBtn.disabled = false;
        signupBtn.textContent = 'Create Account';
        return;
      }

      if (password.length < 8) {
        showError('Password must be at least 8 characters');
        signupBtn.disabled = false;
        signupBtn.textContent = 'Create Account';
        return;
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              full_name: firstName + ' ' + lastName,
            },
          },
        });

        if (error) throw error;

        showSuccess('Account created! Please check your email to verify your account.');
        signupForm.reset();
        strengthBar.className = 'password-strength-bar';
        signupBtn.disabled = false;
        signupBtn.textContent = 'Create Account';
      } catch (error) {
        showError(error.message || 'Signup failed. Please try again.');
        signupBtn.disabled = false;
        signupBtn.textContent = 'Create Account';
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Generate auth callback handler page
 */
export function generateAuthCallbackPage(config: AuthConfig): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authenticating... - ${config.businessName}</title>
  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <style>
    body {
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .loading {
      text-align: center;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: ${config.primaryColor || '#8b5cf6'};
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <p>Completing sign in...</p>
  </div>
  <script>
    const SUPABASE_URL = 'YOUR_SUPABASE_URL';
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Handle the OAuth callback
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        window.location.href = '/dashboard.html';
      }
    });

    // Fallback redirect after 5 seconds
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 5000);
  </script>
</body>
</html>`;
}

/**
 * Generate a protected dashboard page template
 */
export function generateDashboardPage(config: AuthConfig): string {
  const { businessName, primaryColor = '#8b5cf6', logoUrl } = config;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - ${businessName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      background: #0f172a;
      color: white;
    }
    .header {
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, ${primaryColor}, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .user-menu {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .user-email {
      color: #94a3b8;
      font-size: 14px;
    }
    .btn-logout {
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: white;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-logout:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    .main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px;
    }
    h1 {
      font-size: 32px;
      margin-bottom: 8px;
    }
    .welcome-text {
      color: #94a3b8;
      font-size: 16px;
      margin-bottom: 40px;
    }
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 24px;
    }
    .card h3 {
      font-size: 18px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
    }
    .loading {
      display: none;
      position: fixed;
      inset: 0;
      background: #0f172a;
      align-items: center;
      justify-content: center;
    }
    .loading.show {
      display: flex;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: ${primaryColor};
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div id="loading" class="loading show">
    <div class="spinner"></div>
  </div>

  <div id="app" style="display: none;">
    <header class="header">
      <div class="logo">${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" style="height: 32px;">` : businessName}</div>
      <div class="user-menu">
        <span id="user-email" class="user-email"></span>
        <button id="logout-btn" class="btn-logout">Sign Out</button>
      </div>
    </header>

    <main class="main">
      <h1>Welcome back!</h1>
      <p id="welcome-text" class="welcome-text">You're logged in to your ${businessName} account.</p>

      <div class="dashboard-grid">
        <div class="card">
          <h3>📊 Your Profile</h3>
          <p>Manage your account settings, update your profile information, and customize your preferences.</p>
        </div>
        <div class="card">
          <h3>🔐 Security</h3>
          <p>Review your security settings, enable two-factor authentication, and manage connected devices.</p>
        </div>
        <div class="card">
          <h3>📧 Notifications</h3>
          <p>Configure your notification preferences and stay updated on important activities.</p>
        </div>
        <div class="card">
          <h3>🎯 Activity</h3>
          <p>View your recent activity, track your progress, and see detailed analytics.</p>
        </div>
      </div>
    </main>
  </div>

  <script>
    const SUPABASE_URL = 'YOUR_SUPABASE_URL';
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const loading = document.getElementById('loading');
    const app = document.getElementById('app');
    const userEmail = document.getElementById('user-email');
    const welcomeText = document.getElementById('welcome-text');
    const logoutBtn = document.getElementById('logout-btn');

    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = '/login.html';
        return;
      }

      const user = session.user;
      userEmail.textContent = user.email;

      const firstName = user.user_metadata?.first_name || user.email?.split('@')[0];
      welcomeText.textContent = \`Welcome back, \${firstName}! You're logged in to your ${businessName} account.\`;

      loading.classList.remove('show');
      app.style.display = 'block';
    }

    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = '/login.html';
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/login.html';
      }
    });

    checkAuth();
  </script>
</body>
</html>`;
}

/**
 * Generate a magic link login page HTML
 * Passwordless authentication via email magic link
 */
export function generateMagicLinkPage(config: AuthConfig): string {
  const {
    businessName,
    primaryColor = '#8b5cf6',
    secondaryColor = '#06b6d4',
    logoUrl,
  } = config;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Magic Link Login - ${businessName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .magic-link-container {
      width: 100%;
      max-width: 420px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 40px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo-text {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .magic-icon {
      font-size: 48px;
      text-align: center;
      margin-bottom: 20px;
    }
    h1 {
      color: white;
      font-size: 24px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #94a3b8;
      text-align: center;
      margin-bottom: 30px;
      font-size: 14px;
      line-height: 1.6;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 8px;
    }
    input[type="email"] {
      width: 100%;
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: white;
      font-size: 16px;
      transition: all 0.2s;
    }
    input:focus {
      outline: none;
      border-color: ${primaryColor};
      box-shadow: 0 0 0 3px ${primaryColor}33;
    }
    input::placeholder {
      color: #64748b;
    }
    .btn-magic {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-magic:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px ${primaryColor}40;
    }
    .btn-magic:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .btn-magic .sparkle {
      animation: sparkle 1.5s ease-in-out infinite;
    }
    @keyframes sparkle {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.2); }
    }
    .success-state {
      display: none;
      text-align: center;
    }
    .success-state.show {
      display: block;
    }
    .success-state .check-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    .success-state h2 {
      color: white;
      font-size: 24px;
      margin-bottom: 12px;
    }
    .success-state p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
    }
    .form-state {
      display: block;
    }
    .form-state.hide {
      display: none;
    }
    .login-link {
      text-align: center;
      margin-top: 25px;
      color: #94a3b8;
      font-size: 14px;
    }
    .login-link a {
      color: ${primaryColor};
      text-decoration: none;
      font-weight: 500;
    }
    .login-link a:hover {
      text-decoration: underline;
    }
    .error-message {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
      display: none;
    }
    .features {
      display: flex;
      gap: 16px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    .feature {
      flex: 1;
      text-align: center;
    }
    .feature-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }
    .feature-text {
      color: #94a3b8;
      font-size: 12px;
    }
    @media (max-width: 480px) {
      .magic-link-container {
        padding: 30px 20px;
      }
      .features {
        flex-direction: column;
        gap: 12px;
      }
    }
  </style>
</head>
<body>
  <div class="magic-link-container">
    <div class="logo">
      ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" style="height: 60px;">` : `<div class="logo-text">${businessName}</div>`}
    </div>

    <div id="form-state" class="form-state">
      <div class="magic-icon">✨</div>
      <h1>Passwordless Login</h1>
      <p class="subtitle">Enter your email and we'll send you a magic link to sign in instantly. No password needed!</p>

      <div id="error-message" class="error-message"></div>

      <form id="magic-link-form">
        <div class="form-group">
          <label for="email">Email Address</label>
          <input type="email" id="email" name="email" placeholder="you@example.com" required>
        </div>
        <button type="submit" class="btn-magic" id="magic-btn">
          <span class="sparkle">✨</span>
          Send Magic Link
        </button>
      </form>

      <div class="features">
        <div class="feature">
          <div class="feature-icon">🔒</div>
          <div class="feature-text">Secure</div>
        </div>
        <div class="feature">
          <div class="feature-icon">⚡</div>
          <div class="feature-text">Instant</div>
        </div>
        <div class="feature">
          <div class="feature-icon">🚫</div>
          <div class="feature-text">No Password</div>
        </div>
      </div>

      <p class="login-link">
        Prefer password? <a href="login.html">Sign in with password</a>
      </p>
    </div>

    <div id="success-state" class="success-state">
      <div class="check-icon">📧</div>
      <h2>Check Your Email!</h2>
      <p>We've sent a magic link to <strong id="sent-email"></strong>. Click the link in your email to sign in.</p>
      <p style="margin-top: 16px; color: #64748b; font-size: 13px;">Didn't receive it? Check your spam folder or <a href="#" id="resend-link" style="color: ${primaryColor};">resend the link</a></p>
    </div>
  </div>

  <script>
    // Initialize Supabase - Replace with your credentials
    const SUPABASE_URL = 'YOUR_SUPABASE_URL';
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const form = document.getElementById('magic-link-form');
    const magicBtn = document.getElementById('magic-btn');
    const errorMessage = document.getElementById('error-message');
    const formState = document.getElementById('form-state');
    const successState = document.getElementById('success-state');
    const sentEmail = document.getElementById('sent-email');
    const resendLink = document.getElementById('resend-link');
    let lastEmail = '';

    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
    }

    function showSuccess(email) {
      lastEmail = email;
      sentEmail.textContent = email;
      formState.classList.add('hide');
      successState.classList.add('show');
    }

    async function sendMagicLink(email) {
      magicBtn.disabled = true;
      magicBtn.innerHTML = '<span class="sparkle">✨</span> Sending...';
      errorMessage.style.display = 'none';

      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin + '/auth-callback.html'
          }
        });

        if (error) throw error;
        showSuccess(email);
      } catch (error) {
        showError(error.message || 'Failed to send magic link. Please try again.');
        magicBtn.disabled = false;
        magicBtn.innerHTML = '<span class="sparkle">✨</span> Send Magic Link';
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      await sendMagicLink(email);
    });

    resendLink.addEventListener('click', async (e) => {
      e.preventDefault();
      if (lastEmail) {
        formState.classList.remove('hide');
        successState.classList.remove('show');
        document.getElementById('email').value = lastEmail;
        await sendMagicLink(lastEmail);
      }
    });

    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = '/dashboard.html';
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Generate a forgot password page HTML
 */
export function generateForgotPasswordPage(config: AuthConfig): string {
  const {
    businessName,
    primaryColor = '#8b5cf6',
    secondaryColor = '#06b6d4',
    logoUrl,
  } = config;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - ${businessName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .reset-container {
      width: 100%;
      max-width: 420px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 40px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo-text {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .icon {
      font-size: 48px;
      text-align: center;
      margin-bottom: 20px;
    }
    h1 {
      color: white;
      font-size: 24px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #94a3b8;
      text-align: center;
      margin-bottom: 30px;
      font-size: 14px;
      line-height: 1.6;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 8px;
    }
    input[type="email"] {
      width: 100%;
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: white;
      font-size: 16px;
      transition: all 0.2s;
    }
    input:focus {
      outline: none;
      border-color: ${primaryColor};
      box-shadow: 0 0 0 3px ${primaryColor}33;
    }
    input::placeholder {
      color: #64748b;
    }
    .btn-primary {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px ${primaryColor}40;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .back-link {
      text-align: center;
      margin-top: 25px;
      color: #94a3b8;
      font-size: 14px;
    }
    .back-link a {
      color: ${primaryColor};
      text-decoration: none;
      font-weight: 500;
    }
    .back-link a:hover {
      text-decoration: underline;
    }
    .error-message {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
      display: none;
    }
    .success-state {
      display: none;
      text-align: center;
    }
    .success-state.show {
      display: block;
    }
    .success-state .check-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    .success-state h2 {
      color: white;
      font-size: 24px;
      margin-bottom: 12px;
    }
    .success-state p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
    }
    .form-state {
      display: block;
    }
    .form-state.hide {
      display: none;
    }
    @media (max-width: 480px) {
      .reset-container {
        padding: 30px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="reset-container">
    <div class="logo">
      ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" style="height: 60px;">` : `<div class="logo-text">${businessName}</div>`}
    </div>

    <div id="form-state" class="form-state">
      <div class="icon">🔑</div>
      <h1>Reset Password</h1>
      <p class="subtitle">Enter your email address and we'll send you a link to reset your password.</p>

      <div id="error-message" class="error-message"></div>

      <form id="reset-form">
        <div class="form-group">
          <label for="email">Email Address</label>
          <input type="email" id="email" name="email" placeholder="you@example.com" required>
        </div>
        <button type="submit" class="btn-primary" id="reset-btn">Send Reset Link</button>
      </form>

      <p class="back-link">
        Remember your password? <a href="login.html">Sign in</a>
      </p>
    </div>

    <div id="success-state" class="success-state">
      <div class="check-icon">📧</div>
      <h2>Check Your Email!</h2>
      <p>We've sent a password reset link to <strong id="sent-email"></strong>.</p>
      <p style="margin-top: 16px;"><a href="login.html" style="color: ${primaryColor};">Back to login</a></p>
    </div>
  </div>

  <script>
    const SUPABASE_URL = 'YOUR_SUPABASE_URL';
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const form = document.getElementById('reset-form');
    const resetBtn = document.getElementById('reset-btn');
    const errorMessage = document.getElementById('error-message');
    const formState = document.getElementById('form-state');
    const successState = document.getElementById('success-state');
    const sentEmail = document.getElementById('sent-email');

    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
    }

    function showSuccess(email) {
      sentEmail.textContent = email;
      formState.classList.add('hide');
      successState.classList.add('show');
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      resetBtn.disabled = true;
      resetBtn.textContent = 'Sending...';
      errorMessage.style.display = 'none';

      const email = document.getElementById('email').value;

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password.html'
        });

        if (error) throw error;
        showSuccess(email);
      } catch (error) {
        showError(error.message || 'Failed to send reset link. Please try again.');
        resetBtn.disabled = false;
        resetBtn.textContent = 'Send Reset Link';
      }
    });
  </script>
</body>
</html>`;
}

/**
 * AUTH INTENT DETECTION PATTERNS
 */
export const AUTH_INTENT_PATTERNS = [
  // Direct auth requests
  /\b(add|include|implement|create|build|need|want)\s+(login|signin|sign-?in|authentication|auth|user\s+accounts?)\b/i,
  /\b(add|include|implement|create|build)\s+(signup|sign-?up|registration|register)\b/i,
  /\b(login|signin|sign-?in)\s+(page|form|system|feature)\b/i,
  /\b(signup|sign-?up|registration)\s+(page|form|system|feature)\b/i,

  // User account requests
  /\b(user|users?)\s+(accounts?|authentication|login|signin|register)\b/i,
  /\b(let|allow)\s+(users?|people|customers?)\s+(login|signin|sign-?in|register|signup|sign-?up)\b/i,

  // Supabase specific
  /\b(supabase|firebase)\s+auth\b/i,
  /\bsupabase\s+authentication\b/i,

  // OAuth specific
  /\b(google|github|facebook|twitter|apple)\s+(login|signin|sign-?in|oauth)\b/i,
  /\boauth\s+(login|integration|flow)\b/i,

  // Protected routes
  /\b(protect|secure|private)\s+(route|page|section|dashboard|admin)\b/i,
  /\brequire\s+(login|authentication|auth)\b/i,

  // General auth concepts
  /\bpassword\s+(reset|recovery|forgot)\b/i,
  /\bemail\s+(verification|confirm)\b/i,
  /\bmagic\s+link\b/i,
  /\bpasskey|passkeys|biometric\s+login\b/i,
];

/**
 * Check if user wants to add authentication
 */
export function hasAuthIntent(text: string): boolean {
  return AUTH_INTENT_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if user specifically wants magic link authentication
 */
export function hasMagicLinkIntent(text: string): boolean {
  const magicLinkPatterns = [
    /\bmagic\s*link/i,
    /\bpasswordless/i,
    /\bemail\s*(only|link)\s*(login|auth)/i,
    /\bno\s*password/i,
    /\blink\s*(based|only)\s*(login|auth)/i,
    /\bsign\s*in\s*with\s*(email\s*)?link/i,
  ];
  return magicLinkPatterns.some(pattern => pattern.test(text));
}

/**
 * Get all auth pages as an object for multi-page generation
 */
export function generateAuthPages(config: AuthConfig): Record<string, string> {
  const pages: Record<string, string> = {
    'login.html': generateLoginPage(config),
    'signup.html': generateSignupPage(config),
    'auth-callback.html': generateAuthCallbackPage(config),
    'dashboard.html': generateDashboardPage(config),
    'forgot-password.html': generateForgotPasswordPage(config),
  };

  // Add magic link page if enabled in config
  if (config.features?.magicLink) {
    pages['magic-link.html'] = generateMagicLinkPage(config);
  }

  return pages;
}
