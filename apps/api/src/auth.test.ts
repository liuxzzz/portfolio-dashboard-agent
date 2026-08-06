import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import {
  AuthError,
  AuthService,
  MemoryAuthStore,
  type SmsSender,
} from "./auth.js";
import { createPrismaClient } from "./prisma.js";
import { PrismaAuthStore } from "./prisma-auth-store.js";

class CapturingSmsSender implements SmsSender {
  code: string | undefined;

  async sendVerificationCode(_phone: string, code: string) {
    this.code = code;
  }
}

const testSecret = "test-auth-secret-that-is-longer-than-32-characters";

test("rate limits codes and invalidates one after five failed attempts", async () => {
  const sms = new CapturingSmsSender();
  const service = new AuthService(new MemoryAuthStore(), sms, testSecret, {
    now: () => new Date("2026-08-06T00:00:00.000Z"),
    generateCode: () => "123456",
  });
  await service.sendCode("13800138000");
  await assert.rejects(
    service.sendCode("13800138000"),
    (error) => error instanceof AuthError && error.status === 429,
  );
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(service.createSession("13800138000", "000000"));
  }
  await assert.rejects(service.createSession("13800138000", "123456"));
});

test("persists hashed sessions in PostgreSQL and revokes them", {
  skip: process.env.TEST_DATABASE_URL ? false : "TEST_DATABASE_URL is not configured",
}, async (context) => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl);
  const digits = (BigInt(`0x${createHash("sha256").update(randomUUID()).digest("hex").slice(0, 12)}`) % 100_000_000n)
    .toString()
    .padStart(8, "0");
  const phone = `+86139${digits}`;
  const prisma = createPrismaClient(databaseUrl);
  const sms = new CapturingSmsSender();
  const service = new AuthService(new PrismaAuthStore(prisma), sms, testSecret, {
    generateCode: () => "654321",
  });
  let userId: string | undefined;

  context.after(async () => {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  await service.sendCode(phone);
  assert.equal(sms.code, "654321");
  const session = await service.createSession(phone, "654321");
  userId = session.user.id;
  assert.deepEqual(await service.authenticate(session.accessToken), session.user);
  const stored = await prisma.authSession.findFirst({
    where: { userId: session.user.id },
    select: { tokenHash: true },
  });
  assert.ok(stored);
  assert.notEqual(stored.tokenHash, session.accessToken);

  await service.logout(session.accessToken);
  assert.equal(await service.authenticate(session.accessToken), null);
  await assert.rejects(service.createSession(phone, "654321"));
});
