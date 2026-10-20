import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (e.g. /api/auth, /api/health)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, logo.svg, logo-icon.svg
     */
    '/((?!api|_next/static|_next/image|favicon.ico|logo.svg|logo-icon.svg|.*\\.png$).*)',
  ],
};
