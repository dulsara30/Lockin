import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
// Future Google OAuth integration:
// import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authConfig } from './auth.config';
import { connectDB } from './db';
import { User } from '@/server/models/User';
import { checkRateLimit } from './ratelimit';

const loginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((val) => val.trim().toLowerCase()),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // Future Google provider:
    // Google({
    //   clientId: process.env.AUTH_GOOGLE_ID,
    //   clientSecret: process.env.AUTH_GOOGLE_SECRET,
    // }),
    Credentials({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        // Rate limit login attempts: max 5 per minute per email
        const rateLimitResult = await checkRateLimit(`login:${email}`, 5, 60);
        if (!rateLimitResult.success) {
          throw new Error('Too many login attempts. Please wait a moment.');
        }

        await connectDB();

        const user = await User.findOne({ email }).lean();
        if (!user || !user.passwordHash) {
          return null;
        }

        const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordsMatch) {
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name || user.email.split('@')[0],
        };
      },
    }),
  ],
});
