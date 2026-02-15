const VALID_USERNAME = "manager";
const VALID_PASSWORD = "guidedog9000";
const AUTH_COOKIE = "gdf_auth";

export function validateCredentials(username: string, password: string): boolean {
  return username === VALID_USERNAME && password === VALID_PASSWORD;
}

export function getAuthCookie(): string | undefined {
  return AUTH_COOKIE;
}

export function isAuthenticated(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map((c) => {
      const [key, ...v] = c.split("=");
      return [key, v.join("=").trim()];
    })
  );
  return cookies[AUTH_COOKIE] === "1";
}
