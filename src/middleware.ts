import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const sessionCookieNames = ["better-auth.session_token", "__Secure-better-auth.session_token"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = sessionCookieNames.some((name) => request.cookies.get(name)?.value);

  if (!hasSessionCookie && (pathname.startsWith("/admin") || pathname.startsWith("/sales"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSessionCookie && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/admin/:path*", "/sales/:path*"],
};
