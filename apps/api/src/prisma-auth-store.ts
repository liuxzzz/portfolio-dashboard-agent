import type { PortfolioPrismaClient } from "./prisma.js";
import {
  AuthError,
  type AuthStore,
  type SessionCreation,
  type VerificationReservation,
} from "./auth.js";

export class PrismaAuthStore implements AuthStore {
  constructor(private readonly prisma: PortfolioPrismaClient) {}

  async reserveVerificationCode(
    reservation: VerificationReservation,
    limits: { resendSeconds: number; maxPerHour: number },
  ) {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT 1::int AS acquired
        FROM (SELECT pg_advisory_xact_lock(hashtext(${reservation.phone}))) AS phone_lock
      `;
      const hourAgo = new Date(reservation.createdAt.getTime() - 60 * 60 * 1_000);
      const recent = await transaction.smsVerificationCode.findMany({
        where: { phone: reservation.phone, createdAt: { gt: hourAgo } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      const elapsedSeconds = recent[0]
        ? Math.floor(
            (reservation.createdAt.getTime() - recent[0].createdAt.getTime()) / 1_000,
          )
        : Number.POSITIVE_INFINITY;
      if (elapsedSeconds < limits.resendSeconds) {
        throw new AuthError(
          "sms_rate_limited",
          429,
          limits.resendSeconds - elapsedSeconds,
        );
      }
      if (recent.length >= limits.maxPerHour) {
        throw new AuthError("sms_rate_limited", 429, 60 * 60);
      }
      await transaction.smsVerificationCode.create({
        data: reservation,
      });
    });
  }

  async deleteVerificationCode(id: string) {
    await this.prisma.smsVerificationCode.deleteMany({ where: { id } });
  }

  async getLatestVerificationCode(phone: string) {
    return this.prisma.smsVerificationCode.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        phone: true,
        codeHash: true,
        attempts: true,
        expiresAt: true,
        consumedAt: true,
        createdAt: true,
      },
    });
  }

  async recordFailedVerificationAttempt(id: string, now: Date, maxAttempts: number) {
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.smsVerificationCode.updateMany({
        where: { id, consumedAt: null, attempts: { lt: maxAttempts } },
        data: { attempts: { increment: 1 } },
      });
      if (updated.count === 0) return;
      await transaction.smsVerificationCode.updateMany({
        where: { id, consumedAt: null, attempts: { gte: maxAttempts } },
        data: { consumedAt: now },
      });
    });
  }

  async consumeVerificationAndCreateSession(
    verificationId: string,
    phone: string,
    now: Date,
    maxAttempts: number,
    session: SessionCreation,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.smsVerificationCode.updateMany({
        where: {
          id: verificationId,
          phone,
          consumedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: maxAttempts },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return null;
      const user = await transaction.user.upsert({
        where: { phone },
        create: { phone },
        update: {},
        select: { id: true, phone: true, isActive: true },
      });
      if (!user.phone || !user.isActive) return null;
      await Promise.all([
        transaction.smsVerificationCode.update({
          where: { id: verificationId },
          data: { userId: user.id },
        }),
        transaction.authSession.create({
          data: { ...session, userId: user.id, lastSeenAt: now },
        }),
      ]);
      return { id: user.id, phone: user.phone };
    });
  }

  async getSessionByTokenHash(tokenHash: string, now: Date) {
    const session = await this.prisma.authSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { isActive: true, phone: { not: null } },
      },
      include: { user: true },
    });
    if (!session?.user.phone) return null;
    return {
      id: session.id,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      user: { id: session.user.id, phone: session.user.phone },
    };
  }

  async revokeSession(tokenHash: string, now: Date) {
    await this.prisma.authSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async getUserByPhone(phone: string) {
    const user = await this.prisma.user.findFirst({
      where: { phone, isActive: true },
      select: { id: true, phone: true },
    });
    return user?.phone ? { id: user.id, phone: user.phone } : null;
  }
}
