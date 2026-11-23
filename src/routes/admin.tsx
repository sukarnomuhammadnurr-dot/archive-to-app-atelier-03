import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import {
  Users, Clock, CheckCircle, Star, LogOut, TrendingUp, Ticket, ShieldCheck,
  Activity, Calendar, ShieldAlert, MessageSquare, RefreshCw, ArrowUpRight,
  ChevronDown, Camera, Sparkles, Quote,
} from "lucide-react";

export const Route = createFileRoute("/admin")({ component: Admin });

const TZ = "Asia/Jayapura";
const getTodayWIT = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

/* ---------- Sparkline mini (SVG, data real dari services) ---------- */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const pts = useMemo(() => {
    if (data.length < 2) return "";
    const max = Math.max(...data, 1), min = Math.min(...data, 0);
    const w = 70, h = 24, step = w / (data.length - 1);
    return data.map((v, i) => `${i * step},${h - ((v - min) / (max - min || 1)) * h}`).join(" ");
  }, [data]);
  if (!pts) return null;
  return (
    <svg width="70" height="24" className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

function Admin() {
  const navigate = useNavigate();
  const today = getTodayWIT();
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [filterStart, setFilterStart] = useState(today);
  const [filterEnd, setFilterEnd] = useState(today);
  const [stats, setStats] = useState({ total: 0, waiting: 0, called: 0, completed: 0, avgRating: 0 });
  const [services, setServices] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [range, setRange] = useState<"today" | "7" | "30">("7");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [hero, setHero] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);

  // ===== SESSION GUARD (IDENTIK) =====
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => { setSession(s); setChecking(false); });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const role = session?.user?.app_metadata?.role;

  // ===== FETCH (IDENTIK) =====
  const fetchData = async () => {
    const startOfDay = `${filterStart}T00:00:00+09:00`;
    const endOfDay = `${filterEnd}T23:59:59+09:00`;
    const { count: total } = await supabase.from("queues").select("id", { count: "exact", head: true }).gte("created_at", startOfDay).lte("created_at", endOfDay);
    const { count: waiting } = await supabase.from("queues").select("id", { count: "exact", head: true }).eq("status", "waiting").gte("created_at", startOfDay).lte("created_at", endOfDay);
    const { count: called } = await supabase.from("queues").select("id", { count: "exact", head: true }).eq("status", "called").gte("created_at", startOfDay).lte("created_at", endOfDay);
    const { count: completed } = await supabase.from("queues").select("id", { count: "exact", head: true }).eq("status", "completed").gte("created_at", startOfDay).lte("created_at", endOfDay);
    const { data: fbs } = await supabase.from("feedbacks").select("*").gte("created_at", startOfDay).lte("created_at", endOfDay).order("created_at", { ascending: false });
    setFeedbacks(fbs || []);
    const avg = fbs?.length ? (fbs.reduce((a: number, c: any) => a + c.rating, 0) / fbs.length) : 0;
    const { data: svcData } = await supabase.from("queues").select("service_type").gte("created_at", startOfDay).lte("created_at", endOfDay);
    const svcCount: Record<string, number> = {};
    svcData?.forEach((q: any) => { svcCount[q.service_type] = (svcCount[q.service_type] || 0) + 1; });
    const maxVal = Math.max(...Object.values(svcCount), 1);
    setServices(Object.entries(svcCount).map(([name, count]) => ({ name, count, pct: (count / maxVal) * 100 })));
    const { data: hist } = await supabase.from("queues").select("*, feedbacks(rating)").gte("created_at", startOfDay).lte("created_at", endOfDay).order("created_at", { ascending: false }).limit(30);
    setHistory(hist || []);
    setStats({ total: total || 0, waiting: waiting || 0, called: called || 0, completed: completed || 0, avgRating: Number(avg.toFixed(1)) });
  };

  // ===== REALTIME + POLLING (IDENTIK) =====
  useEffect(() => {
    if (role !== "admin") return;
    fetchData();
    const iv = setInterval(fetchData, 3000);
    const ch = supabase.channel("admin-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "queues" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "feedbacks" }, fetchData)
      .subscribe();
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  }, [role, filterStart, filterEnd]);

  // ===== LOAD UPLOAD YANG DISIMPAN =====
  useEffect(() => {
    setAvatar(localStorage.getItem("admin_avatar"));
    setHero(localStorage.getItem("admin_hero"));
  }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>, key: "admin_avatar" | "admin_hero", setter: (v: string) => void) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { const d = String(r.result); setter(d); localStorage.setItem(key, d); };
    r.readAsDataURL(f);
  };

  const applyRange = (r: "today" | "7" | "30") => {
    setRange(r);
    if (r === "today") { setFilterStart(today); setFilterEnd(today); }
    else {
      const d = new Date(); d.setDate(d.getDate() - (r === "7" ? 6 : 29));
      setFilterStart(d.toLocaleDateString("en-CA", { timeZone: TZ })); setFilterEnd(today);
    }
  };

  const isTodayRange = filterStart === today && filterEnd === today;
  const formatTanggal = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const namaAdmin = session?.user?.user_metadata?.full_name || (session?.user?.email || "Admin").split("@")[0];
  const sparkData = services.map((s: any) => s.count);
  const tableData = showAll ? history : history.slice(0, 5);

  // ===== GUARD (IDENTIK) =====
  if (checking) return <div className="min-h-screen grid place-items-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-emerald-600 grid place-items-center animate-pulse"><ShieldCheck className="w-6 h-6 text-white" /></div><p className="text-sm font-semibold text-slate-500">Memverifikasi akses…</p></div></div>;
  if (!session) return <div className="min-h-screen grid place-items-center p-4"><div className="text-center p-8 bg-white rounded-3xl shadow-xl max-w-sm w-full"><ShieldAlert className="w-10 h-10 text-emerald-600 mx-auto mb-3" /><h2 className="text-xl font-extrabold">Login Diperlukan</h2><Link to="/login" className="mt-5 block bg-emerald-600 text-white py-3 rounded-2xl font-bold">Login Admin</Link></div></div>;
  if (role !== "admin") return <div className="min-h-screen grid place-items-center p-4"><div className="text-center p-8 bg-white rounded-3xl shadow-xl max-w-sm w-full"><ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" /><h2 className="text-xl font-extrabold">Akses Ditolak</h2><button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }} className="mt-5 w-full bg-emerald-600 text-white py-3 rounded-2xl font-bold">Ganti Akun</button></div></div>;

  return (
    <div className="relative min-h-screen font-sans pb-14 overflow-x-hidden">
      {/* ===== LATAR "STITCH": gradient mesh hijau + dot halus ===== */}
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(135deg,#eaf6e6_0%,#f6faf4_40%,#e6f4ea_100%)]" />
      <div className="fixed inset-0 -z-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(#34a8531a 1px, transparent 1px)", backgroundSize: "20px 20px", maskImage: "radial-gradient(ellipse at top, black 35%, transparent 80%)" }} />
      <div className="fixed -top-32 -right-24 w-96 h-96 rounded-full bg-emerald-300/30 blur-3xl -z-10" />
      <div className="fixed top-1/2 -left-24 w-80 h-80 rounded-full bg-lime-200/30 blur-3xl -z-10" />

      {/* ===== HEADER HIJAU WAVE ===== */}
      <header className="relative bg-gradient-to-r from-[#2E7D32] via-[#43A047] to-[#66BB6A] px-5 md:px-10 pt-6 pb-20 overflow-hidden">
        {hero && <img src={hero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[#2E7D32]/80 to-transparent" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => avatarRef.current?.click()} className="relative w-16 h-16 rounded-full bg-white/20 ring-2 ring-white/40 grid place-items-center overflow-hidden shrink-0 group">
              {avatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : <Users className="w-8 h-8 text-white" />}
              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 grid place-items-center transition"><Camera className="w-5 h-5 text-white" /></span>
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e, "admin_avatar", setAvatar)} />
            <div className="min-w-0">
              <p className="text-white/85 text-sm">Selamat Datang, 👋</p>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight truncate">{namaAdmin}</h1>
              <p className="text-white/70 text-xs mt-0.5">Monitor & Kelola Data Antrean dengan lebih mudah</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => heroRef.current?.click()} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 px-3 py-2 rounded-xl transition"><Camera className="w-4 h-4" />Ganti Latar</button>
            <input ref={heroRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e, "admin_hero", setHero)} />
            <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }} className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 bg-white hover:bg-slate-50 px-4 py-2.5 rounded-xl shadow-sm transition"><LogOut className="w-4 h-4" />Keluar</button>
          </div>
        </div>
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="absolute bottom-[-1px] left-0 w-full h-12 block text-[#eef6ec]"><path fill="currentColor" d="M0,30 C360,60 720,0 1080,30 C1260,45 1380,20 1440,30 L1440,60 L0,60 Z" /></svg>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 -mt-6 space-y-6">
        {/* ===== KPI ===== */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <Kpi icon={<Users className="w-5 h-5" />} ring="bg-emerald-100 text-emerald-600" label="Total Periode" value={stats.total} sub={`${stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}% tuntas`} spark={sparkData} color="#34a853" />
          <Kpi icon={<Calendar className="w-5 h-5" />} ring="bg-amber-100 text-amber-600" label="Menunggu" value={stats.waiting} sub="antrean" spark={sparkData} color="#f59e0b" />
          <Kpi icon={<Activity className="w-5 h-5" />} ring="bg-blue-100 text-blue-600" label="Diproses" value={stats.called} sub="aktif" spark={sparkData} color="#3b82f6" />
          <Kpi icon={<CheckCircle className="w-5 h-5" />} ring="bg-teal-100 text-teal-600" label="Selesai" value={stats.completed} sub="layanan" spark={sparkData} color="#14b8a6" />
          <Kpi icon={<Star className="w-5 h-5" />} ring="bg-violet-100 text-violet-600" label="Penilaian Rata-Rata" value={`${stats.avgRating} / 5`} sub="rating" spark={feedbacks.map((f: any) => f.rating)} color="#8b5cf6" highlight />
        </div>

        {/* ===== PERIODE MTD ===== */}
        <section className="bg-white/90 backdrop-blur rounded-3xl border border-emerald-100 shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-2 text-emerald-700 mb-3"><Calendar className="w-5 h-5" /><span className="text-sm font-bold">Periode Laporan (MTD):</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
            <label className="block"><span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Dari Tanggal</span><input type="date" value={filterStart} onChange={(e) => { const v = e.target.value; setFilterStart(v); if (v > filterEnd) setFilterEnd(v); }} max={today} className="w-full bg-emerald-50/60 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20" /></label>
            <span className="hidden sm:flex items-center pb-2 text-slate-400 font-bold text-xl">→</span>
            <label className="block"><span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Sampai Tanggal</span><input type="date" value={filterEnd} onChange={(e) => { const v = e.target.value; setFilterEnd(v); if (v < filterStart) setFilterStart(v); }} max={today} className="w-full bg-emerald-50/60 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20" /></label>
            <button onClick={fetchData} className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#2E7D32] to-[#43A047] hover:from-[#1B5E20] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/25 transition active:scale-95 self-end"><RefreshCw className="w-4 h-4" />Refresh Data</button>
          </div>
        </section>

        {/* ===== AKTIVITAS + RIWAYAT ===== */}
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-white/90 backdrop-blur rounded-3xl border border-emerald-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 grid place-items-center"><TrendingUp className="w-5 h-5" /></div><div><h3 className="font-extrabold text-slate-800">Aktivitas per Layanan</h3><p className="text-[11px] text-slate-400">Ringkasan aktivitas dalam periode ini</p></div></div>
              <div className="relative">
                <select value={range} onChange={(e) => applyRange(e.target.value as any)} className="appearance-none text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg pl-3 pr-7 py-1.5 outline-none">
                  <option value="today">Hari Ini</option><option value="7">7 Hari</option><option value="30">30 Hari</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-emerald-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-4">
              {services.length === 0 ? <Empty icon={<Ticket className="w-5 h-5" />} text="Belum ada data di periode ini" /> : services.map((s: any, i: number) => (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2"><span className={`w-6 h-6 rounded-lg grid place-items-center ${["bg-emerald-100 text-emerald-600", "bg-blue-100 text-blue-600", "bg-amber-100 text-amber-600"][i % 3]}`}>{[<ShieldCheck key="a" className="w-3.5 h-3.5" />, <Users key="b" className="w-3.5 h-3.5" />, <Ticket key="c" className="w-3.5 h-3.5" />][i % 3]}</span><span className="font-bold text-slate-700 capitalize">{s.name.replace(/_/g, " ")}</span></div>
                    <span className="text-slate-500 tabular-nums font-semibold">{s.count}/{Math.max(s.count, 1)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden"><div className={`h-2.5 rounded-full ${["bg-emerald-500", "bg-blue-500", "bg-amber-500"][i % 3]} transition-all duration-700`} style={{ width: `${s.pct}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white/90 backdrop-blur rounded-3xl border border-emerald-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 grid place-items-center"><Clock className="w-5 h-5" /></div><div><h3 className="font-extrabold text-slate-800">Riwayat Antrean</h3><p className="text-[11px] text-slate-400">{history.length} antrean di periode ini</p></div></div>
              <button onClick={() => setShowAll((v) => !v)} className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">{showAll ? "Sembunyikan" : "Lihat Semua"} <ArrowUpRight className="w-3.5 h-3.5" /></button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-emerald-50/50 text-emerald-700 text-[11px] uppercase tracking-wider"><tr><th className="text-left px-3 py-2.5 font-bold">No</th><th className="text-left px-3 py-2.5 font-bold">Nama</th><th className="text-left px-3 py-2.5 font-bold">Status</th><th className="text-right px-3 py-2.5 font-bold">Rating</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {tableData.length === 0 ? <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-400">Belum ada riwayat.</td></tr> : tableData.map((h: any, i: number) => (
                    <tr key={h.id} className="hover:bg-emerald-50/40 transition">
                      <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2.5"><p className="font-bold text-slate-800">{h.queue_number}</p><p className="text-xs text-slate-500 truncate max-w-[140px]">{h.customer_name}</p></td>
                      <td className="px-3 py-2.5"><span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${h.status === "completed" ? "bg-emerald-100 text-emerald-700" : h.status === "called" ? "bg-blue-100 text-blue-700" : h.status === "skipped" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"}`}>{h.status === "completed" ? "Selesai" : h.status === "called" ? "Diproses" : h.status === "skipped" ? "Dilewat" : "Menunggu"}</span></td>
                      <td className="px-3 py-2.5 text-right"><Stars value={h.feedbacks?.[0]?.rating} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ===== UMPAN BALIK ===== */}
        <section className="bg-white/90 backdrop-blur rounded-3xl border border-emerald-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 grid place-items-center"><MessageSquare className="w-5 h-5" /></div><div><h3 className="font-extrabold text-slate-800">Umpan Balik & Komentar Pelanggan</h3><p className="text-[11px] text-slate-400">Penilaian realtime dari peserta layanan</p></div></div>
            {feedbacks.length > 0 && <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-4 h-4 ${n <= Math.round(stats.avgRating) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div>}
          </div>
          {feedbacks.length === 0 ? <Empty icon={<MessageSquare className="w-5 h-5" />} text="Belum ada umpan balik di periode ini" /> : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {feedbacks.map((fb: any) => (
                <div key={fb.id} className="relative p-4 rounded-2xl bg-gradient-to-r from-emerald-50/70 to-white border border-emerald-100 hover:border-emerald-300 transition">
                  <Quote className="absolute right-4 top-4 w-8 h-8 text-emerald-200" />
                  <div className="flex items-center gap-2 mb-1"><span className="font-bold text-slate-800 text-sm">Antrean {fb.queue_number}</span><span className="text-xs text-slate-400">• {new Date(fb.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>
                  <div className="flex gap-0.5 mb-2">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-4 h-4 ${n <= fb.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div>
                  {fb.comment && <p className="text-sm text-slate-700 italic">"{fb.comment}"</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon, ring, label, value, sub, spark, color, highlight }: any) {
  return (
    <div className={`bg-white/90 backdrop-blur p-4 rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${highlight ? "border-emerald-300 ring-1 ring-emerald-500/20" : "border-emerald-100"}`}>
      <div className={`w-10 h-10 rounded-xl grid place-items-center mb-3 ${ring}`}>{icon}</div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 truncate">{label}</p>
      <div className="flex items-end justify-between gap-2 mt-0.5">
        <div><p className="font-black text-slate-800 text-2xl tabular-nums leading-none">{value}</p><p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />{sub}</p></div>
        <Sparkline data={spark} color={color} />
      </div>
    </div>
  );
}
function Stars({ value }: { value?: number }) {
  if (!value) return <span className="text-xs text-slate-300">—</span>;
  return <div className="flex gap-0.5 justify-end">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-4 h-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div>;
}
function Empty({ icon, text }: any) {
  return <div className="flex flex-col items-center gap-2 py-8 text-slate-400"><div className="w-11 h-11 rounded-xl bg-slate-100 grid place-items-center">{icon}</div><p className="text-sm">{text}</p></div>;
}
