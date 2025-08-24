import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple admin authentication check
function isAuthenticated(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') {
    // In development, allow access without authentication
    return true;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    // If no admin password is set, deny access
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return false;
  }

  // Simple basic auth: admin:<password>
  const expectedAuth = `Basic ${Buffer.from(`admin:${adminPassword}`).toString('base64')}`;
  return authHeader === expectedAuth;
}

export function middleware(request: NextRequest) {
  // Protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!isAuthenticated(request)) {
      return new NextResponse(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Basic realm="Admin Area"',
          },
        }
      );
    }
  }

  // Rate limiting headers for API routes (if rate limiting is enabled)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    
    // Add CORS headers for API routes
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
  ],
};