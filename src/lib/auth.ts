import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
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
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;

      const email = profile?.email?.trim().toLowerCase();
      if (!email || profile?.email_verified !== true) return false;

      await connectDB();
      // Link to an existing credentials account with the same email, or auto-register
      let dbUser = await User.findOne({ email });
      if (!dbUser) {
        dbUser = await User.create({ email, name: profile?.name || email.split('@')[0] });
      }

      // Use our own user id (not Google's) so all userId-scoped data matches
      user.id = dbUser._id.toString();
      user.name = dbUser.name || user.name;
      return true;
    },
  },
  providers: [
    // Reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from the environment
    Google,
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
