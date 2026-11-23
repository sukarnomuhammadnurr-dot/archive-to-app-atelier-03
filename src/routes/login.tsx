import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { supabase } from "../integrations/supabase/client";

export const Route = createFileRoute("/login")({ component: Login });

function Wave() {
  return (
    <svg viewBox="0 0 400 42" preserveAspectRatio="none" className="absolute bottom-[-1px] left-0 w-full h-10 block">
      <path fill="#ffffff" d="M0,22 C90,44 150,4 220,18 C290,32 340,8 400,22 L400,42 L0,42 Z" />
    </svg>
  );
}

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError("Email dan password wajib diisi.");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setError("Email atau password salah.");
    } else {
      const role = data?.user?.app_metadata?.["role"];
      if (role === "admin") {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/petugas" });
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-[#F6F8F5] flex items-center justify-center p-4 overflow-hidden">
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div className="relative w-full max-w-[420px]">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-[#4A7C2F] text-sm font-semibold mb-4 transition">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
        </Link>

        <div className="animate-[fadeUp_.5s_ease] rounded-[32px] bg-white shadow-[0_24px_70px_-30px_rgba(20,40,30,.25)] border border-[#4A7C2F]/10 overflow-hidden">
          <div className="relative bg-[#4A7C2F] px-7 pt-10 pb-16 text-center overflow-hidden">
            <div className="relative mx-auto mb-3 h-16 w-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h1 className="relative text-2xl font-extrabold tracking-tight text-white">Login Petugas</h1>
            <p className="relative mt-1 text-[13px] text-white/70">Masuk untuk mengakses dashboard</p>
            <Wave />
          </div>

          <div className="px-7 pt-3 pb-7">
            <h2 className="text-[22px] leading-tight font-extrabold tracking-tight text-slate-800">
              Welcome back
              <br />
              <span className="italic text-[#4A7C2F]">Masuk ke akun Anda</span>
            </h2>
            <p className="mt-2 mb-5 text-[13px] text-slate-400">Masukkan email dan password untuk melanjutkan</p>

            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="mb-1.5 block px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Email</label>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all focus-within:border-[#4A7C2F] focus-within:ring-2 focus-within:ring-[#4A7C2F]/20">
                  <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Masukkan email"
                    className="w-full bg-transparent outline-none text-[15px] text-slate-800 placeholder:text-slate-400" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Password</label>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all focus-within:border-[#4A7C2F] focus-within:ring-2 focus-within:ring-[#4A7C2F]/20">
                  <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                  <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan password"
                    className="w-full bg-transparent outline-none text-[15px] text-slate-800 placeholder:text-slate-400" />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="text-slate-400 hover:text-[#4A7C2F] transition">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-center">{error}</p>}

              <button type="submit" disabled={loading}
                className="group relative w-full mt-1 rounded-2xl bg-[#4A7C2F] hover:bg-[#3d6826] px-5 py-4 text-white font-bold text-[15px] shadow-lg shadow-[#4A7C2F]/30 transition-all active:scale-[.98] disabled:opacity-60 disabled:active:scale-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Memproses…</> : "Login"}
                </span>
                {!loading && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Info</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <p className="text-center text-[12px] text-slate-500">
              Belum punya akun? Hubungi admin untuk dibuatkan akses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
