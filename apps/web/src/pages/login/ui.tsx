import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { createSession, requestSmsCode, type Session } from "@/shared/api/portfolio";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
export function LoginPage({ onLogin, health }: { onLogin: (session: Session) => void; health: string }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { if (!cooldown) return; const id = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000); return () => window.clearTimeout(id); }, [cooldown]);
  async function send() {
    if (!/^1[3-9]\d{9}$/.test(phone)) { setMessage("请输入正确的中国大陆手机号。"); return; }
    setBusy(true); setMessage(null);
    try { const result = await requestSmsCode(phone); setCooldown(result.retryAfterSeconds); setMessage("验证码已发送，请留意短信。"); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "验证码发送失败"); }
    finally { setBusy(false); }
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    if (!/^1[3-9]\d{9}$/.test(phone) || code.length !== 6) return;
    setBusy(true); setMessage(null);
    try { onLogin(await createSession(phone, code)); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "登录失败"); }
    finally { setBusy(false); }
  }
  return <div className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]"><div className="flex min-h-72 flex-col justify-between bg-[#19314a] p-8 text-white lg:p-14"><div className="flex items-center gap-3 font-bold"><ShieldCheck />Portfolio Agent</div><div className="max-w-xl py-14"><p className="text-xs font-bold tracking-[.24em] text-sky-200">EVIDENCE FIRST</p><h1 className="mt-5 text-4xl font-bold leading-tight md:text-5xl">看清你的组合，<br />追溯每一条观察。</h1><p className="mt-6 text-slate-300">在 Web 上管理持仓、行业标签与 Agent 分析。Android 和 Web 使用同一个账户与 Portfolio API。</p></div><p className="text-xs text-slate-400">组合数据与 Agent 结果来自当前登录账户</p></div><div className="flex items-center justify-center p-6 md:p-12"><Card className="w-full max-w-md"><CardHeader><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary"><ShieldCheck /></div><CardTitle className="text-2xl">登录工作台</CardTitle><CardDescription>使用手机号验证码访问已有账户。API 状态：{health === "ready" ? "已连接" : health === "offline" ? "未连接" : "检测中"}</CardDescription></CardHeader><CardContent><form onSubmit={(event) => void login(event)} className="space-y-4"><div><label htmlFor="phone" className="mb-2 block text-sm font-medium">手机号</label><Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="中国大陆手机号" required /></div><div><div className="mb-2 flex items-center justify-between"><label htmlFor="code" className="text-sm font-medium">验证码</label><Button type="button" variant="ghost" size="sm" disabled={busy || cooldown > 0 || phone.length !== 11} onClick={() => void send()}>{cooldown ? `${cooldown}s 后重发` : "获取验证码"}</Button></div><Input id="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 位验证码" required /></div>{message && <p role="status" className="text-sm text-primary">{message}</p>}<Button className="w-full" type="submit" disabled={busy || phone.length !== 11 || code.length !== 6}>{busy ? "正在处理…" : "登录"}<ArrowRight className="h-4 w-4" /></Button><p className="text-xs text-muted-foreground">会话仅保存在当前浏览器标签页。</p></form></CardContent></Card></div></div>;
}
