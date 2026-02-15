import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthenticated, getAuthCookie } from "@/lib/auth";

const publicPaths = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (isAuthenticated(request)) {
      return NextResponse.redirect(new URL("/forecast", request.url));
    }
    return NextResponse.next();
  }

  if (!isAuthenticated(request)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
