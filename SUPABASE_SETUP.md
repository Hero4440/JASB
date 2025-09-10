# JASB Supabase Configuration Guide

## 🔧 Required Configuration

Your Supabase project URL: `https://eavfihctpkxicrkaeene.supabase.co`

### 1. Get Your Anon Key

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/eavfihctpkxicrkaeene
2. Navigate to **Settings** → **API**
3. Copy the **anon/public** key
4. Update `.env.local` with your real anon key:

```env
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

### 2. Configure Auth Settings

In your Supabase dashboard:

1. **Auth** → **Settings** → **Auth Settings**
2. Set **Site URL**: `jasb://auth/verify`
3. Add **Additional Redirect URLs**:
   ```
   http://localhost:3000/auth/verify
   http://localhost:19006/auth/verify
   jasb://auth/verify
   jasb://
   ```

### 3. Email Templates

In **Auth** → **Templates**, customize your email templates:

**Confirm Signup Template:**
```html
<h2>Confirm your signup</h2>
<p>Welcome to JASB! Click the link below to verify your account:</p>
<p><a href="{{ .ConfirmationURL }}">Verify your account</a></p>
```

**Reset Password Template:**
```html
<h2>Reset your password</h2>
<p>Click the link below to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
```

### 4. User Database Schema

Make sure your users table in Supabase matches our backend schema:

```sql
-- This should already exist in your Supabase project
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Policy to allow users to update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);
```

### 5. Database Triggers (Optional)

To automatically create user profiles when users sign up:

```sql
-- Function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, name, avatar_url)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## 🧪 Testing Email Verification

1. **Start the app**: `npm run dev:ios`
2. **Sign up** with a real email address
3. **Check your email** for the verification link
4. **Click the link** - it should open the app and show verification success
5. **Sign in** with your verified account

## 🔍 Troubleshooting

### Email Links Not Working
- Make sure redirect URLs are configured correctly
- Check that your app scheme `jasb://` is working
- Test with `npx expo install expo-linking` if needed

### Database Errors
- Ensure your backend database has the users table created
- Check that RLS policies match between Supabase and your backend

### Authentication Issues
- Verify your anon key is correct
- Check that email confirmation is enabled in Supabase auth settings
- Make sure your .env.local is loaded correctly

## 🎯 Current Status

✅ Supabase project created: `https://eavfihctpkxicrkaeene.supabase.co`
✅ Email verification screens created
✅ Deep linking configured
⚠️  **TODO**: Update .env.local with real anon key
⚠️  **TODO**: Configure Supabase auth settings