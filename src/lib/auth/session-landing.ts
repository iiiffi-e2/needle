import { NextResponse } from "next/server";

/**
 * Finish sign-in with a document instead of a redirect.
 * A cross-site return (Google, a magic link, a Fediverse server) that
 * sets the session cookie and immediately sends the browser to the next
 * page can paint that page before the cookie is stored. Navigating from
 * the load event happens after the browser has stored it.
 */
export function sessionLandingResponse(location: string): NextResponse {
  if (/[\u0000-\u001f\u007f]/.test(location)) {
    throw new Error("Invalid session landing location");
  }
  const scriptUrl = JSON.stringify(location).replace(/</g, "\\u003c");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Needle</title></head><body><script>addEventListener("load",function(){location.replace(${scriptUrl})})</script></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
