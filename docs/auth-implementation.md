# Authentication Implementation Guide

## Overview

This document outlines the complete implementation of email-based authentication with email verification for the JASB expense splitting app using Supabase.

## Current Setup

- **Frontend**: React Native Expo with Supabase client
- **Backend**: Fastify with JWT verification
- **Auth Provider**: Supabase Auth
- **UI Components**: Sign-up, Sign-in, Password Reset (already implemented)

## Authentication Flow

### 1. User Registration Flow

```
User enters email/password →
signUpWithEmail() called →
Supabase sends verification email →
User clicks link in email →
Deep link opens app at /auth/verify →
Supabase confirms email →
Database trigger creates user profile →
User is automatically signed in
```

### 2. Email Verification Setup

#### A. Configure Supabase Email Templates

1. Navigate to **Supabase Dashboard → Authentication → Email Templates**
2. Select **"Confirm signup"** template
3. Customize the email template with your branding
4. Set the confirmation URL format:
   ```
   {{ .ConfirmationURL }}
   ```
   Or for custom redirect:
   ```
   yourapp://auth/verify?token_hash={{ .TokenHash }}&type=signup
   ```

#### B. Configure Email Provider

**Development (Built-in Supabase Email):**
- Limited to 4 emails/hour on free tier
- Suitable for testing only

**Production (SMTP Configuration):**
1. Go to **Supabase Dashboard → Project Settings → SMTP**
2. Choose an email provider:
   - **SendGrid**: Easy setup, good deliverability
   - **AWS SES**: Cost-effective for high volume
   - **Mailgun**: Good for transactional emails
   - **Resend**: Modern, developer-friendly

3. Example SMTP Configuration (SendGrid):
   ```
   Host: smtp.sendgrid.net
   Port: 587
   Username: apikey
   Password: <your-sendgrid-api-key>
   Sender: noreply@yourapp.com
   ```

### 3. Deep Linking Configuration

#### A. Update Supabase URL Configuration

1. **Supabase Dashboard → Authentication → URL Configuration**
2. Configure the following:

   **Site URL**:
   ```
   https://yourapp.com
   ```

   **Redirect URLs** (whitelist these patterns):
   ```
   yourapp://auth/verify
   yourapp://auth/callback
   yourapp://auth/reset-password
   exp://localhost:8081/--/auth/verify (for local dev)
   exp://192.168.*.*:8081/--/auth/verify (for LAN dev)
   ```

#### B. App Configuration (app.json/app.config.js)

Ensure your app scheme is configured:

```json
{
  "expo": {
    "scheme": "yourapp",
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp",
      "associatedDomains": ["applinks:yourapp.com"]
    },
    "android": {
      "package": "com.yourcompany.yourapp",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "yourapp.com",
              "pathPrefix": "/auth"
            },
            {
              "scheme": "yourapp"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### 4. Database User Profile Creation

#### Option A: Database Trigger (Recommended)

Create a PostgreSQL trigger in Supabase SQL Editor:

```sql
-- Create users table if not exists
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own data
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Create policy for users to update their own data
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.created_at
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on email confirmation
CREATE TRIGGER on_auth_user_created
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- Also create user immediately if email confirmation is disabled
CREATE TRIGGER on_auth_user_created_immediate
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();
```

#### Option B: Supabase Edge Function

Create a webhook Edge Function (`supabase/functions/on-user-created/index.ts`):

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { record } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Create user profile
  const { error } = await supabase
    .from('users')
    .insert({
      id: record.id,
      email: record.email,
      name: record.raw_user_meta_data?.name,
      created_at: record.created_at
    })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400 }
    )
  }

  return new Response(
    JSON.stringify({ message: 'User profile created' }),
    { status: 200 }
  )
})
```

Then configure the webhook in Supabase Dashboard:
1. Go to **Database → Webhooks**
2. Create new webhook for `auth.users` table
3. Select `INSERT` event
4. Point to your Edge Function URL

### 5. Environment Configuration

#### Frontend (.env)

```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App Configuration
EXPO_PUBLIC_APP_SCHEME=yourapp
EXPO_PUBLIC_SITE_URL=https://yourapp.com
```

#### Backend (.env)

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# JWT Configuration (for token verification)
SUPABASE_JWT_SECRET=your-jwt-secret

# Server Configuration
PORT=3000
NODE_ENV=production
```

### 6. Supabase Authentication Settings

Configure in **Supabase Dashboard → Authentication → Settings**:

#### Email Auth Settings:
- ✅ **Enable email confirmations**: ON
- ✅ **Secure email change**: ON
- ✅ **Email confirmation grace period**: 24 hours
- ✅ **Minimum password length**: 6 characters (or higher)

#### Email Rate Limiting:
```
Maximum emails per hour: 10 (adjust based on needs)
```

#### Session Settings:
```
JWT expiry: 3600 seconds (1 hour)
Refresh token rotation: Enabled
```

### 7. Email Verification Screen

The app already has `/app/auth/verify.tsx`. Ensure it handles the token properly:

```typescript
// Example verification handler
useEffect(() => {
  const handleEmailVerification = async () => {
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get('token_hash');
    const type = params.get('type');

    if (token_hash && type === 'signup') {
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'signup'
      });

      if (error) {
        Alert.alert('Verification Failed', error.message);
      } else {
        Alert.alert('Success', 'Email verified! You can now sign in.');
        router.replace('/');
      }
    }
  };

  handleEmailVerification();
}, []);
```

### 8. Security Considerations

#### Password Requirements:
- ✅ Minimum 6 characters (currently implemented)
- 🔄 Consider adding: uppercase, lowercase, number, special character

#### Security Best Practices:
- ✅ Email verification prevents fake signups
- ✅ Use HTTPS for all redirect URLs in production
- ✅ Validate email format on both client and server
- ✅ Implement rate limiting for signup attempts
- ✅ Store sensitive keys in environment variables
- ✅ Enable Row Level Security (RLS) on all tables
- ✅ Use service role key only on backend, never expose to client

#### Additional Security Measures:
```typescript
// Add to sign-up validation
const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isStrongPassword = (password: string) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};
```

### 9. Testing Checklist

#### Development Testing:
- [ ] Test sign-up with valid email
- [ ] Verify email sent and received
- [ ] Click verification link - app opens correctly
- [ ] User profile created in database
- [ ] User automatically signed in after verification
- [ ] Test sign-up with invalid email format
- [ ] Test password mismatch error
- [ ] Test weak password error

#### Email Testing:
- [ ] Verify email deliverability (check spam folder)
- [ ] Test email template rendering
- [ ] Verify all links work correctly
- [ ] Test on multiple email providers (Gmail, Outlook, etc.)

#### Deep Link Testing:
- [ ] Test deep link on iOS simulator
- [ ] Test deep link on Android emulator
- [ ] Test deep link on physical iOS device
- [ ] Test deep link on physical Android device
- [ ] Test with app closed
- [ ] Test with app in background

### 10. Production Deployment Checklist

#### Pre-deployment:
- [ ] Configure production SMTP provider
- [ ] Set up database trigger for user profile creation
- [ ] Configure production redirect URLs
- [ ] Update environment variables for production
- [ ] Enable email confirmations in Supabase
- [ ] Set up custom email templates with branding
- [ ] Configure proper error logging and monitoring

#### Post-deployment:
- [ ] Test complete sign-up flow in production
- [ ] Monitor email delivery rates
- [ ] Check error logs for auth failures
- [ ] Verify database triggers are working
- [ ] Test password reset flow
- [ ] Set up alerts for auth errors

### 11. Additional Features to Implement

#### Resend Verification Email:
```typescript
const resendVerificationEmail = async (email: string) => {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email,
  });

  if (error) {
    Alert.alert('Error', error.message);
  } else {
    Alert.alert('Success', 'Verification email sent!');
  }
};
```

#### Check Email Verification Status:
```typescript
const checkEmailVerification = async () => {
  const { data: { user } } = await supabase.auth.getUser();

  if (user && !user.email_confirmed_at) {
    // Show verification reminder
    Alert.alert(
      'Verify Email',
      'Please check your email and click the verification link.',
      [
        { text: 'Resend Email', onPress: () => resendVerificationEmail(user.email) },
        { text: 'OK' }
      ]
    );
  }
};
```

### 12. Troubleshooting

#### Common Issues:

**Email not received:**
- Check spam/junk folder
- Verify SMTP configuration
- Check email rate limits
- Verify sender domain authentication (SPF, DKIM)

**Deep link not working:**
- Verify app scheme configuration
- Check redirect URLs whitelist
- Test with different URL formats
- Check iOS Universal Links / Android App Links setup

**User profile not created:**
- Check database trigger execution
- Verify RLS policies
- Check service role key permissions
- Look for errors in database logs

**Token verification fails:**
- Check token expiration (24 hour default)
- Verify JWT secret configuration
- Check for URL encoding issues

### 13. Monitoring and Analytics

Track key metrics:
- Sign-up conversion rate
- Email verification rate
- Time to verify email
- Failed authentication attempts
- Email delivery success rate

Use Supabase Dashboard or integrate with:
- PostHog
- Mixpanel
- Amplitude
- Custom analytics solution

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Expo Deep Linking Guide](https://docs.expo.dev/guides/deep-linking/)
- [React Native Authentication Best Practices](https://reactnative.dev/docs/security)
