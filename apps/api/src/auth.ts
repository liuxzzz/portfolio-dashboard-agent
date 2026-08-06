import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

export const SMS_CODE_TTL_SECONDS = 5 * 60;
export const SMS_RESEND_INTERVAL_SECONDS = 60;
export const SMS_MAX_ATTEMPTS = 5;
export const SMS_MAX_PER_HOUR = 10;
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface AuthUser {
  id: string;
  phone: string;
}

export interface AuthSessionResult {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
}

export interface StoredVerificationCode {
  id: string;
  phone: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

interface StoredSession {
  id: string;
  user: AuthUser;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface VerificationReservation {
  id: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SessionCreation {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthStore {
  reserveVerificationCode(
    reservation: VerificationReservation,
    limits: { resendSeconds: number; maxPerHour: number },
  ): Promise<void>;
  deleteVerificationCode(id: string): Promise<void>;
  getLatestVerificationCode(phone: string): Promise<StoredVerificationCode | null>;
  recordFailedVerificationAttempt(
    id: string,
    now: Date,
    maxAttempts: number,
  ): Promise<void>;
  consumeVerificationAndCreateSession(
    verificationId: string,
    phone: string,
    now: Date,
    maxAttempts: number,
    session: SessionCreation,
  ): Promise<AuthUser | null>;
  getSessionByTokenHash(tokenHash: string, now: Date): Promise<StoredSession | null>;
  revokeSession(tokenHash: string, now: Date): Promise<void>;
  getUserByPhone(phone: string): Promise<AuthUser | null>;
}

export interface SmsSender {
  sendVerificationCode(phone: string, code: string): Promise<void>;
}

export class AuthError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 401 | 429 | 503,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}

export function normalizeMainlandPhone(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  const local = compact.startsWith("+86")
    ? compact.slice(3)
    : compact.startsWith("86") && compact.length === 13
      ? compact.slice(2)
      : compact;
  if (!/^1[3-9]\d{9}$/.test(local)) {
    throw new AuthError("invalid_phone", 400);
  }
  return `+86${local}`;
}

export function smsPhoneNumber(phone: string) {
  return phone.startsWith("+86") ? phone.slice(3) : phone;
}

export function maskPhone(phone: string) {
  const local = smsPhoneNumber(phone);
  return `${local.slice(0, 3)}****${local.slice(-4)}`;
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function codeHash(secret: string, id: string, phone: string, code: string) {
  return createHmac("sha256", secret)
    .update(`${id}:${phone}:${code}`)
    .digest("hex");
}

function hashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export class AuthService {
  constructor(
    private readonly store: AuthStore,
    private readonly smsSender: SmsSender,
    private readonly secret: string,
    private readonly options: {
      now?: () => Date;
      generateCode?: () => string;
      generateToken?: () => string;
      generateId?: () => string;
    } = {},
  ) {
    if (secret.length < 32) {
      throw new Error("AUTH_SECRET 至少需要 32 个字符");
    }
  }

  async sendCode(rawPhone: string) {
    const phone = normalizeMainlandPhone(rawPhone);
    const now = this.now();
    const id = this.options.generateId?.() ?? randomUUID();
    const code =
      this.options.generateCode?.() ?? randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.store.reserveVerificationCode(
      {
        id,
        phone,
        codeHash: codeHash(this.secret, id, phone, code),
        createdAt: now,
        expiresAt: new Date(now.getTime() + SMS_CODE_TTL_SECONDS * 1_000),
      },
      {
        resendSeconds: SMS_RESEND_INTERVAL_SECONDS,
        maxPerHour: SMS_MAX_PER_HOUR,
      },
    );
    try {
      await this.smsSender.sendVerificationCode(phone, code);
    } catch (error) {
      await this.store.deleteVerificationCode(id);
      const authError = new AuthError("sms_unavailable", 503);
      authError.cause = error;
      throw authError;
    }
    return { sent: true as const, retryAfterSeconds: SMS_RESEND_INTERVAL_SECONDS };
  }

  async createSession(rawPhone: string, code: string): Promise<AuthSessionResult> {
    const phone = normalizeMainlandPhone(rawPhone);
    if (!/^\d{6}$/.test(code)) throw new AuthError("invalid_code", 400);
    const now = this.now();
    const verification = await this.store.getLatestVerificationCode(phone);
    if (
      !verification ||
      verification.consumedAt ||
      verification.expiresAt <= now ||
      verification.attempts >= SMS_MAX_ATTEMPTS
    ) {
      throw new AuthError("invalid_or_expired_code", 400);
    }
    const receivedHash = codeHash(this.secret, verification.id, phone, code);
    if (!hashesMatch(receivedHash, verification.codeHash)) {
      await this.store.recordFailedVerificationAttempt(
        verification.id,
        now,
        SMS_MAX_ATTEMPTS,
      );
      throw new AuthError("invalid_or_expired_code", 400);
    }

    const accessToken =
      this.options.generateToken?.() ?? randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1_000);
    const user = await this.store.consumeVerificationAndCreateSession(
      verification.id,
      phone,
      now,
      SMS_MAX_ATTEMPTS,
      {
        id: this.options.generateId?.() ?? randomUUID(),
        tokenHash: tokenHash(accessToken),
        createdAt: now,
        expiresAt,
      },
    );
    if (!user) throw new AuthError("invalid_or_expired_code", 400);
    return { accessToken, expiresAt: expiresAt.toISOString(), user };
  }

  async authenticate(accessToken: string | undefined) {
    if (!accessToken) return null;
    return (await this.store.getSessionByTokenHash(tokenHash(accessToken), this.now()))
      ?.user ?? null;
  }

  async logout(accessToken: string | undefined) {
    if (accessToken) {
      await this.store.revokeSession(tokenHash(accessToken), this.now());
    }
  }

  async getUserByPhone(rawPhone: string) {
    const phone = normalizeMainlandPhone(rawPhone);
    return this.store.getUserByPhone(phone);
  }

  private now() {
    return this.options.now?.() ?? new Date();
  }
}

export class MemoryAuthStore implements AuthStore {
  private readonly codes = new Map<string, StoredVerificationCode>();
  private readonly users = new Map<string, AuthUser>();
  private readonly sessions = new Map<string, StoredSession>();

  async reserveVerificationCode(
    reservation: VerificationReservation,
    limits: { resendSeconds: number; maxPerHour: number },
  ) {
    const recent = [...this.codes.values()]
      .filter(
        (code) =>
          code.phone === reservation.phone &&
          code.createdAt > new Date(reservation.createdAt.getTime() - 60 * 60 * 1_000),
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const elapsedSeconds = recent[0]
      ? Math.floor((reservation.createdAt.getTime() - recent[0].createdAt.getTime()) / 1_000)
      : Number.POSITIVE_INFINITY;
    if (elapsedSeconds < limits.resendSeconds) {
      throw new AuthError("sms_rate_limited", 429, limits.resendSeconds - elapsedSeconds);
    }
    if (recent.length >= limits.maxPerHour) {
      throw new AuthError("sms_rate_limited", 429, 60 * 60);
    }
    this.codes.set(reservation.id, {
      ...reservation,
      attempts: 0,
      consumedAt: null,
    });
  }

  async deleteVerificationCode(id: string) {
    this.codes.delete(id);
  }

  async getLatestVerificationCode(phone: string) {
    return (
      [...this.codes.values()]
        .filter((code) => code.phone === phone)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null
    );
  }

  async recordFailedVerificationAttempt(id: string, now: Date, maxAttempts: number) {
    const code = this.codes.get(id);
    if (!code) return;
    code.attempts += 1;
    if (code.attempts >= maxAttempts) code.consumedAt = now;
  }

  async consumeVerificationAndCreateSession(
    verificationId: string,
    phone: string,
    now: Date,
    maxAttempts: number,
    session: SessionCreation,
  ) {
    const code = this.codes.get(verificationId);
    if (
      !code ||
      code.consumedAt ||
      code.expiresAt <= now ||
      code.attempts >= maxAttempts
    ) return null;
    code.consumedAt = now;
    let user = [...this.users.values()].find((candidate) => candidate.phone === phone);
    if (!user) {
      user = { id: `user-${this.users.size + 1}`, phone };
      this.users.set(user.id, user);
    }
    this.sessions.set(session.tokenHash, {
      id: session.id,
      user,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      revokedAt: null,
    });
    return user;
  }

  async getSessionByTokenHash(hash: string, now: Date) {
    const session = this.sessions.get(hash);
    return session && !session.revokedAt && session.expiresAt > now ? session : null;
  }

  async revokeSession(hash: string, now: Date) {
    const session = this.sessions.get(hash);
    if (session) session.revokedAt = now;
  }

  async getUserByPhone(phone: string) {
    return [...this.users.values()].find((user) => user.phone === phone) ?? null;
  }
}
