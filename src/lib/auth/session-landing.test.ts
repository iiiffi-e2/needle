import { describe, expect, it } from "vitest";
import { sessionLandingResponse } from "./session-landing";

describe("sessionLandingResponse", () => {
  it("navigates only after the document loads", async () => {
    const response = sessionLandingResponse("http://localhost:3000/rooms");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("refresh")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    const html = await response.text();
    expect(html).toContain('addEventListener("load"');
    expect(html).toContain('location.replace("http://localhost:3000/rooms")');
    expect(html).not.toContain("http-equiv");
  });

  it("keeps a breakout sequence inside the script string", async () => {
    const response = sessionLandingResponse(
      "http://localhost:3000/</script>"
    );
    const html = await response.text();
    expect(html).toContain(
      'location.replace("http://localhost:3000/\\u003c/script>")'
    );
    expect(html.match(/<\/script>/g)).toEqual(["</script>"]);
  });

  it("rejects a location that could break the response headers", () => {
    expect(() =>
      sessionLandingResponse("http://localhost:3000/\r\nSet-Cookie: a=b")
    ).toThrow("Invalid session landing location");
  });
});
