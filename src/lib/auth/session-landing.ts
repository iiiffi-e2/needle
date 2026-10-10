import { NextResponse } from "next/server";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Finish sign-in with a document instead of a 302.
 * A cross-site return (Google, a magic link, a Fediverse server) that
 * sets the session cookie and redirects in the same response can paint
 * the next page before the browser stores that cookie.
 */
export function sessionLandingResponse(location: string): NextResponse {
  if (/[\u0000-\u001f\u007f]/.test(location)) {
    throw new Error("Invalid session landing location");
  }
  const safe = escapeHtml(location);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safe}"><title>Needle</title></head><body><a href="${safe}">Continue</a></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      Refresh: `0;url=${location}`,
    },
  });
}
