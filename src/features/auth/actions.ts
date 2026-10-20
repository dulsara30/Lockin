'use server';

import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { User } from '@/server/models/User';
import { signupSchema, SignupInput } from './schemas';
import { checkRateLimit } from '@/lib/ratelimit';

export async function signupUser(input: SignupInput) {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid input data.',
    };
  }

  const { email, password, name } = parsed.data;

  // Rate limit signup requests: max 5 per 10 minutes per email
  const rateLimit = await checkRateLimit(`signup:${email}`, 5, 600);
  if (!rateLimit.success) {
    return {
      success: false,
      error: 'Too many signup attempts. Please try again later.',
    };
  }

  try {
    await connectDB();

    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      // Return generic error message to prevent email enumeration
      return {
        success: false,
        error: 'An account with this email already exists or credentials are invalid.',
      };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await User.create({
      email,
      name,
      passwordHash,
    });

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error('Signup error:', error instanceof Error ? error.message : 'Unknown');
    return {
      success: false,
      error: 'Unable to create account. Please try again.',
    };
  }
}
