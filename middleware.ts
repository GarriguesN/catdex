import { auth } from "@/lib/auth";

export default auth;

export const config = {
  matcher: [
    // Protect all routes except static assets and auth
    "/((?!_next/static|_next/image|favicon.ico|icon-|apple-touch|manifest.json|sw.js).*)",
  ],
};
