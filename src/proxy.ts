import { NextResponse, type NextRequest } from "next/server";

const REPORTS_PREFIX = "/app/reports/";

/**
 * A report URL with malformed percent-encoding (e.g. /app/reports/%E0%A4%A) makes the production
 * router fail with a bare "500 Internal Server Error" before any page code runs. Proxy still runs
 * for such paths, so send them to the report page's "invalid link" state instead.
 * Scoped to report URLs; well-formed IDs pass through untouched.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  try {
    decodeURIComponent(pathname.slice(REPORTS_PREFIX.length));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL(`${REPORTS_PREFIX}invalid`, request.url));
  }
}

export const config = {
  matcher: "/app/reports/:path*",
};
