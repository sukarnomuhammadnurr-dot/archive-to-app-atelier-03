import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { Users, Clock, CheckCircle, Star, LogOut, ArrowLeft, TrendingUp, Ticket, ShieldCheck, Activity, Calendar, ShieldAlert, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: Admin });

const TZ = "Asia/Jayapura";
const getTodayWIT = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

function Wave() {
  return (<svg viewBox="0 0 400 42" preserveAspectRatio="none" className="absolute bottom-[-1px] left-0 w-full h-10 block"><path fill="#F6F8F5" d="M0,22 C90,44 150,4 220,18 C290,32 340,8 400,22 L400,42 L0,42 Z" /></svg>);
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
  const [feedbacks, setFeedbacks] = useState<any[]>([]); // 🔥 STATE BARU UNTUK KOMENTAR

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => { setSession(s); setChecking(false); });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const role = session?.user?.app_metadata?.role;

  const fetchData = async () => {
    const startOfDay = `${filterStart}T00:00:00`;
    const endOfDay = `${filterEnd}T23:59:59`;

    const { count: total } = await supabase.from("queues").select("id", { count: "exact", head: true }).gte("created_at", startOfDay).lte("created_at", endOfDay);
    const { count: waiting } = await supabase.from("queues").select("id", { count: "exact", head: true }).eq("status", "waiting").gte("created_at", startOfDay).lte("created_at", endOfDay);
    const { count: called } = await supabase.from("queues").select("id", { count: "exact", head: true }).eq("status", "called").gte("created_at", startOfDay).lte("created_at", endOfDay);
    const { count: completed } = await supabase.from("queues").select("id", { count: "exact", head: true }).eq("status", "completed").gte("created_at", startOfDay).lte("created_at", endOfDay);

    const { data: fbs } = await supabase.from("feedbacks").select("*").gte("created_at", startOfDay).lte("created_at", endOfDay).order("created_at", { ascending: false });
    setFeedbacks(fbs || []); // 🔥 SIMPAN DATA FEEDBACK
    
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

  useEffect(() => {
    if (role !== "admin") return;
    fetchData();
    const ch = supabase.channel("admin-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "queues" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "feedbacks" }, fetchData) // 🔥 REALTIME FEEDBACK
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [role, filterStart, filterEnd]);

  const isTodayRange = filterStart === today && filterEnd === today;
  const formatTanggal = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  if (checking) return <div className="min-h-screen flex items-center justify-center bg-[#F6F8F5]"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-[#4A7C2F] flex items-center justify-center animate-pulse"><ShieldCheck className="w-6 h-6 text-white" /></div><p className="text-sm font-semibold text-slate-500">Memverifikasi akses…</p></div></div>;
  if (!session) return <div className="min-h-screen flex items-center justify-center bg-[#F6F8F5] p-4"><div className="text-center p-8 bg-white rounded-3xl shadow-xl border border-[#4A7C2F]/10 max-w-sm w-full"><div className="w-16 h-16 bg-[#4A7C2F]/10 text-[#4A7C2F] rounded-2xl flex items-center justify-center mx-auto mb-4"><ShieldAlert className="w-8 h-8" /></div><h2 className="text-xl font-extrabold text-slate-800">Login Diperlukan</h2><Link to="/login" className="inline-flex items-center justify-center gap-2 w-full mt-6 bg-[#4A7C2F] hover:bg-[#3d6826] text-white px-6 py-3.5 rounded-2xl font-bold transition active:scale-95">Login Admin</Link></div></div>;
  if (role !== "admin") return <div className="min-h-screen flex items-center justify-center bg-[#F6F8F5] p-4"><div className="text-center p-8 bg-white rounded-3xl shadow-xl border border-red-100 max-w-sm w-full"><div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><ShieldAlert className="w-8 h-8" /></div><h2 className="text-xl font-extrabold text-slate-800">Akses Ditolak</h2><button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }} className="inline-flex items-center justify-center gap-2 w-full mt-6 bg-[#4A7C2F] hover:bg-[#3d6826] text-white px-6 py-3.5 rounded-2xl font-bold transition active:scale-95"><LogOut className="w-4 h-4" /> Ganti Akun</button></div></div>;

  return (
    <div className="relative min-h-screen bg-[#F6F8F5] font-sans pb-14 overflow-x-hidden">
      <div className="absolute inset-0 -z-0 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "22px 22px", maskImage: "radial-gradient(ellipse at top, black 30%, transparent 75%)" }} />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#4A7C2F]/10 blur-3xl" />
      </div>

      <header className="relative bg-[#4A7C2F] px-5 md:px-8 pt-5 pb-16 overflow-hidden">
        <div className="absolute -top-16 -left-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition shrink-0"><ArrowLeft className="w-4 h-4" /></Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-white">Pintar Panel</h1>
                <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/25 text-white text-[11px] font-bold px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-lime-300 animate-pulse" />ADMIN</span>
              </div>
              <p className="text-[12px] text-white/70 mt-0.5 truncate">Monitoring real-time & laporan • {session.user?.email}</p>
            </div>
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }} className="flex items-center gap-2 text-[13px] font-semibold text-[#4A7C2F] bg-white hover:bg-slate-50 px-3.5 py-2.5 rounded-xl transition active:scale-95 shadow-sm"><LogOut className="w-4 h-4" /> Keluar</button>
        </div>
        <Wave />
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 -mt-4 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <Stat icon={<Ticket className="w-5 h-5" />} tint="brand" label="Total Periode" value={stats.total} unit="orang" />
          <Stat icon={<Clock className="w-5 h-5" />} tint="amber" label="Menunggu" value={stats.waiting} unit="antrean" />
          <Stat icon={<Activity className="w-5 h-5" />} tint="blue" label="Diproses" value={stats.called} unit="aktif" />
          <Stat icon={<CheckCircle className="w-5 h-5" />} tint="emerald" label="Selesai" value={stats.completed} unit="selesai" />
          <Stat icon={<Star className="w-5 h-5" />} tint="violet" label="Rata-rata Rating" value={stats.avgRating} unit="/ 5" highlight />
        </div>

        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 md:p-5">
          <div className="flex items-center gap-2 text-[#4A7C2F] mb-3">
            <Calendar className="w-5 h-5" />
            <span className="text-sm font-bold">Periode Laporan (WIT):</span>
            <span className="text-xs font-semibold text-slate-500 ml-auto">{isTodayRange ? "📅 Hari ini" : `📅 ${formatTanggal(filterStart)} — ${formatTanggal(filterEnd)}`}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Dari Tanggal</label>
              <input type="date" value={filterStart} onChange={(e) => { const v = e.target.value; setFilterStart(v); if (v > filterEnd) setFilterEnd(v); }} max={today} className="bg-[#4A7C2F]/5 border border-[#4A7C2F]/20 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#4A7C2F]/20 focus:border-[#4A7C2F] outline-none" />
            </div>
            <div className="hidden sm:flex items-center justify-center text-slate-400 font-bold text-xl pb-2">→</div>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Sampai Tanggal</label>
              <input type="date" value={filterEnd} onChange={(e) => { const v = e.target.value; setFilterEnd(v); if (v < filterStart) setFilterStart(v); }} max={today} className="bg-[#4A7C2F]/5 border border-[#4A7C2F]/20 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#4A7C2F]/20 focus:border-[#4A7C2F] outline-none" />
            </div>
            {!isTodayRange && <button onClick={() => { setFilterStart(today); setFilterEnd(today); }} className="text-xs font-bold text-[#4A7C2F] hover:bg-[#4A7C2F]/10 px-4 py-2.5 rounded-xl transition self-end">Reset Hari Ini</button>}
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-xl bg-[#4A7C2F]/10 text-[#4A7C2F] flex items-center justify-center"><TrendingUp className="w-5 h-5" /></div>
              <div><h3 className="font-extrabold text-slate-800 tracking-tight">Antrean per Layanan</h3><p className="text-[11px] text-slate-400">{isTodayRange ? "Hari ini" : `${formatTanggal(filterStart)} — ${formatTanggal(filterEnd)}`}</p></div>
            </div>
            <div className="space-y-4">
              {services.length === 0 ? <div className="flex flex-col items-center gap-2 py-8"><div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center"><Ticket className="w-6 h-6 text-slate-300" /></div><p className="text-sm font-semibold text-slate-400">Belum ada data di periode ini</p></div> : services.map((s: any) => (
                <div key={s.name}>
                  <div className="flex justify-between text-sm mb-1.5"><span className="font-bold text-slate-700">{s.name}</span><span className="text-slate-500 tabular-nums">{s.count} orang</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden"><div className="bg-gradient-to-r from-[#4A7C2F] to-[#6ba33e] h-3 rounded-full transition-all duration-700" style={{ width: `${s.pct}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 overflow-hidden">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-xl bg-[#4A7C2F]/10 text-[#4A7C2F] flex items-center justify-center"><Users className="w-5 h-5" /></div>
              <div><h3 className="font-extrabold text-slate-800 tracking-tight">Riwayat Antrean</h3><p className="text-[11px] text-slate-400">{history.length} antrean di periode ini</p></div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#4A7C2F]/5 text-[#4A7C2F] text-[11px] uppercase tracking-wider sticky top-0">
                  <tr><th className="text-left px-3 py-2.5 font-bold">No</th><th className="text-left px-3 py-2.5 font-bold">Nama</th><th className="text-left px-3 py-2.5 font-bold">Status</th><th className="text-left px-3 py-2.5 font-bold">Rating</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length === 0 ? <tr><td colSpan={4} className="px-3 py-10 text-center text-sm text-slate-400">Belum ada riwayat.</td></tr> : history.map((h: any) => (
                    <tr key={h.id} className="hover:bg-[#4A7C2F]/[0.03] transition">
                      <td className="px-3 py-2.5"><span className="bg-[#4A7C2F]/10 text-[#4A7C2F] font-bold px-2 py-0.5 rounded-lg text-xs">{h.queue_number}</span></td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700 truncate max-w-[120px]">{h.customer_name}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${h.status === "completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : h.status === "called" ? "bg-[#4A7C2F]/10 text-[#4A7C2F] border border-[#4A7C2F]/20" : h.status === "skipped" ? "bg-slate-100 text-slate-500 border border-slate-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                          {h.status === "completed" ? "Selesai" : h.status === "called" ? "Diproses" : h.status === "skipped" ? "Dilewat" : "Menunggu"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-amber-500 text-xs">{h.feedbacks?.[0]?.rating ? "★".repeat(h.feedbacks[0].rating) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* 🔥 SECTION BARU: UMpan BALIK & KOMENTAR PELANGGAN */}
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><MessageSquare className="w-5 h-5" /></div>
            <div>
              <h3 className="font-extrabold text-slate-800 tracking-tight">Umpan Balik & Komentar Pelanggan</h3>
              <p className="text-[11px] text-slate-400">Penilaian realtime dari antrean yang telah selesai</p>
            </div>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {feedbacks.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">Belum ada umpan balik di periode ini.</div>
            ) : (
              feedbacks.map((fb: any) => (
                <div key={fb.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-[#4A7C2F]/30 transition">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">Antrean {fb.queue_number}</span>
                      <span className="text-xs text-slate-500">• {new Date(fb.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (<Star key={i} className={`w-4 h-4 ${i < fb.rating ? "fill-amber-400" : "text-slate-200"}`} />))}
                    </div>
                  </div>
                  {fb.comment && <p className="text-sm text-slate-700 italic bg-white p-3 rounded-xl border border-slate-100">"{fb.comment}"</p>}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, tint, label, value, unit, highlight }: { icon: React.ReactNode, tint: string, label: string, value: string | number, unit?: string, highlight?: boolean }) {
  const map: Record<string, string> = { brand: "bg-[#4A7C2F]/10 text-[#4A7C2F]", blue: "bg-blue-50 text-blue-600", amber: "bg-amber-50 text-amber-600", emerald: "bg-emerald-50 text-emerald-600", violet: "bg-violet-50 text-violet-600", slate: "bg-slate-100 text-slate-600" };
  return (
    <div className={`bg-white p-4 md:p-5 rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${highlight ? "border-[#4A7C2F]/30 ring-1 ring-[#4A7C2F]/20 bg-[#4A7C2F]/[0.04]" : "border-slate-100 hover:border-[#4A7C2F]/20"}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mb-3 ${map[tint] || map["brand"]}`}>{icon}</div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{label}</p>
      <p className="font-black text-slate-800 leading-tight mt-0.5 text-2xl tabular-nums">{value} {unit && <span className="text-[11px] font-semibold text-slate-400 ml-0.5">{unit}</span>}</p>
    </div>
  );
}
