import jwt from "jsonwebtoken";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { prisma } from "../src/utils/db";
import { startTestServer, api, TestServer } from "./helpers/server";

const run = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const password = "TestPass123!";
const emails = {
  USER: `user-${run}@test.local`,
  GUARD: `guard-${run}@test.local`,
  ADMIN: `admin-${run}@test.local`,
};

let srv: TestServer;
const createdUserIds: string[] = [];

const login = (email: string) =>
  api(srv.baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

const authHeader = (token: string) => ({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  srv = await startTestServer();
  const passwordHash = await bcrypt.hash(password, 4);

  for (const role of ["USER", "GUARD", "ADMIN"] as const) {
    const user = await prisma.user.create({
      data: {
        name: `${role} test`,
        email: emails[role],
        passwordHash,
        role,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(user.id);
  }
});

afterAll(async () => {
  const testUsers = await prisma.user.findMany({
    where: { email: { contains: `@test.local` } },
    select: { id: true },
  });
  const testUserIds = Array.from(new Set([...createdUserIds, ...testUsers.map((user) => user.id)]));

  // Refresh tokens reference users, so they must be removed first.
  await prisma.refreshToken.deleteMany({ where: { userId: { in: testUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  await srv.close();
  await prisma.$disconnect();
});

describe("public registration cannot grant staff roles", () => {
  it("ignores role=ADMIN and always creates a USER", async () => {
    const email = `escalate-admin-${run}@test.local`;
    const res = await api(srv.baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Esc", email, password, role: "ADMIN" }),
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("USER");

    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored?.role).toBe("USER");

    // The issued access token must not carry ADMIN either.
    const decoded = jwt.decode(res.body.data.tokens.accessToken) as jwt.JwtPayload;
    expect(decoded.role).toBe("USER");
  });

  it("ignores role=GUARD", async () => {
    const email = `escalate-guard-${run}@test.local`;
    const res = await api(srv.baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Esc2", email, password, role: "GUARD" }),
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("USER");
  });

  it("only an ADMIN can create staff accounts", async () => {
    const adminLogin = await login(emails.ADMIN);
    expect(adminLogin.status).toBe(200);

    const userLogin = await login(emails.USER);
    expect(userLogin.status).toBe(200);

    const asAdmin = await api(srv.baseUrl, "/api/users", {
      method: "POST",
      headers: authHeader(adminLogin.body.data.tokens.accessToken),
      body: JSON.stringify({
        name: "Created Guard",
        email: `created-guard-${run}@test.local`,
        password,
        role: "GUARD",
      }),
    });

    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.data.user.role).toBe("GUARD");

    const asUser = await api(srv.baseUrl, "/api/users", {
      method: "POST",
      headers: authHeader(userLogin.body.data.tokens.accessToken),
      body: JSON.stringify({
        name: "Nope",
        email: `nope-${run}@test.local`,
        password,
        role: "ADMIN",
      }),
    });

    expect(asUser.status).toBe(403);
  });
});

describe("refresh tokens", () => {
  it.each(["USER", "GUARD", "ADMIN"] as const)(
    "refreshes a %s session with role/email taken from the database",
    async (role) => {
      const session = await login(emails[role]);
      expect(session.status).toBe(200);

      const refreshToken = session.body.data.tokens.refreshToken;
      const refreshed = await api(srv.baseUrl, "/api/auth/refresh", {
        method: "POST",
        headers: authHeader(refreshToken),
      });

      expect(refreshed.status).toBe(200);
      expect(typeof refreshed.body.data.accessToken).toBe("string");
      expect(typeof refreshed.body.data.refreshToken).toBe("string");

      const stored = await prisma.user.findUnique({ where: { email: emails[role] } });
      const decoded = jwt.decode(refreshed.body.data.accessToken) as jwt.JwtPayload;
      expect(decoded.role).toBe(stored?.role);
      expect(decoded.email).toBe(stored?.email);

      const me = await api(srv.baseUrl, "/api/auth/me", {
        headers: authHeader(refreshed.body.data.accessToken),
      });
      expect(me.status).toBe(200);
      expect(me.body.data.role).toBe(role);
      expect(me.body.data.email).toBe(emails[role]);

      // The rotated access token carries real permissions.
      const list = await api(srv.baseUrl, "/api/users", {
        headers: authHeader(refreshed.body.data.accessToken),
      });
      expect(list.status).toBe(role === "ADMIN" ? 200 : 403);
    }
  );

  it("derives a promoted role from the database instead of the token payload", async () => {
    const session = await login(emails.USER);
    expect(session.status).toBe(200);

    await prisma.user.update({ where: { email: emails.USER }, data: { role: "GUARD" } });

    try {
      const refreshed = await api(srv.baseUrl, "/api/auth/refresh", {
        method: "POST",
        headers: authHeader(session.body.data.tokens.refreshToken),
      });

      expect(refreshed.status).toBe(200);
      const decoded = jwt.decode(refreshed.body.data.accessToken) as jwt.JwtPayload;
      expect(decoded.role).toBe("GUARD");
    } finally {
      await prisma.user.update({ where: { email: emails.USER }, data: { role: "USER" } });
    }
  });

  it("rejects an access token at the refresh endpoint", async () => {
    const session = await login(emails.USER);
    const res = await api(srv.baseUrl, "/api/auth/refresh", {
      method: "POST",
      headers: authHeader(session.body.data.tokens.accessToken),
    });

    expect(res.status).toBe(401);
  });

  it("rejects a refresh token on protected routes", async () => {
    const session = await login(emails.ADMIN);
    const res = await api(srv.baseUrl, "/api/users", {
      headers: authHeader(session.body.data.tokens.refreshToken),
    });

    expect(res.status).toBe(401);
  });

  it("rejects a rotated (replayed) refresh token", async () => {
    const session = await login(emails.USER);
    const refreshToken = session.body.data.tokens.refreshToken;

    const first = await api(srv.baseUrl, "/api/auth/refresh", {
      method: "POST",
      headers: authHeader(refreshToken),
    });
    expect(first.status).toBe(200);

    const replay = await api(srv.baseUrl, "/api/auth/refresh", {
      method: "POST",
      headers: authHeader(refreshToken),
    });
    expect(replay.status).toBe(401);

    const fromNewToken = await api(srv.baseUrl, "/api/auth/refresh", {
      method: "POST",
      headers: authHeader(first.body.data.refreshToken),
    });
    expect(fromNewToken.status).toBe(200);
  });

  it("logout revokes the refresh token", async () => {
    const session = await login(emails.USER);
    const { accessToken, refreshToken } = session.body.data.tokens;

    const logout = await api(srv.baseUrl, "/api/auth/logout", {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify({ refreshToken }),
    });
    expect(logout.status).toBe(200);

    const afterLogout = await api(srv.baseUrl, "/api/auth/refresh", {
      method: "POST",
      headers: authHeader(refreshToken),
    });
    expect(afterLogout.status).toBe(401);
  });
});

describe("error responses", () => {
  it("never exposes a stack trace", async () => {
    const res = await api(srv.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: emails.USER, password: "wrong-password" }),
    });

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty("stack");
    expect(JSON.stringify(res.body)).not.toContain("HttpResponseError");
  });

  it("returns the documented envelope for validation errors", async () => {
    const res = await api(srv.baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "", email: "not-an-email", password: "123" }),
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body).not.toHaveProperty("stack");
  });
});
