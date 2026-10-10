import { describe, expect, it } from "vitest";
import { sessionLandingResponse } from "./session-landing";

describe("sessionLandingResponse", () => {
  it("returns a document that continues after the session cookie can be stored", async () => {
    const response = sessionLandingResponse("http://localhost:3000/rooms");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("refresh")).toBe(
      "0;url=http://localhost:3000/rooms"
    );
    const html = await response.text();
    expect(html).toContain(
      'content="0;url=http://localhost:3000/rooms"'
    );
    expect(html).toContain('href="http://localhost:3000/rooms"');
  });

  it("escapes the location in the document", async () => {
    const response = sessionLandingResponse(
      'http://localhost:3000/rooms?q=">'
    );
    const html = await response.text();
    expect(html).not.toContain('url=http://localhost:3000/rooms?q=">');
    expect(html).toContain(
      "url=http://localhost:3000/rooms?q=&quot;&gt;"
    );
  });

  it("rejects a location that could break the refresh header", () => {
    expect(() => sessionLandingResponse("http://localhost:3000/\r\nSet-Cookie: a=b")).toThrow(
      "Invalid session landing location"
    );
  });
});
