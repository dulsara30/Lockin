import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
    newUser: '/signup',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup');

      const isProtectedRoute =
        pathname === '/' ||
        pathname.startsWith('/today') ||
        pathname.startsWith('/runway') ||
        pathname.startsWith('/missions') ||
        pathname.startsWith('/planner') ||
        pathname.startsWith('/insights') ||
        pathname.startsWith('/templates') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/how-it-works') ||
        pathname.startsWith('/lockin');

      if (isAuthRoute) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/today', nextUrl));
        }
        return true;
      }

      if (isProtectedRoute) {
        if (!isLoggedIn) {
          return false; // Redirects to /login
        }
        return true;
      }

      return true;
    },
  },
  providers: [], // Configured with credentials in auth.ts (and Google in future)
};
