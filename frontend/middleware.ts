import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the response
  const response = NextResponse.next();

  // Add CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent');
  response.headers.set('Access-Control-Max-Age', '86400');

  // Add security headers with adjusted Content-Security-Policy to allow ngrok
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'no-referrer');
  
  // Updated CSP to allow requests to ngrok
  response.headers.set(
    'Content-Security-Policy', 
    "default-src 'self'; connect-src 'self' https://*.ngrok-free.app https://vortexus.vercel.app https://*.vercel.app;"
  );

  return response;
}

// Handle preflight OPTIONS requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, User-Agent',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/api/:path*'],
}; 