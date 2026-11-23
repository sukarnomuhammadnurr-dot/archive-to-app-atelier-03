import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import {
  Users, Clock, CheckCircle, Star, LogOut, TrendingUp, Ticket, ShieldCheck,
  Activity, Calendar, ShieldAlert, MessageSquare, Gauge, Download,
  BarChart3, LayoutDashboard, Bell, Sparkles, ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/admin")({ component: Admin });

const TZ = "Asia/Jayapura";
const getTodayWIT = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

const NAV = [
  { id: "overview", label: "Ringkasan", icon: LayoutDashboard },
  { id: "analytics", label: "Analitik Layanan", icon: BarChart3 },
  { id: "history", label: "Riwayat Antrean", icon: Users },
  { id: "feedback", label: "Umpan Balik", icon: MessageSquare },
];

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

  // ===== SESSION GUARD (TETAP IDENTIK) =====
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => { setSession(s); setChecking(false); });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const role = session?.user?.app_metadata?.role;

  // ===== FETCH (TETAP IDENTIK) =====
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

  // ===== REALTIME + POLLING (TETAP IDENTIK) =====
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

  const isTodayRange = filterStart === today && filterEnd === today;
  const formatTanggal = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  // ===== EXPORT CSV (bonus, pakai data existing) =====
  const exportCSV = () => {
    const rows = [["No", "Nama", "Status", "Rating"], ...history.map((h: any) => [h.queue_number, h.customer_name, h.status, h.feedbacks?.[0]?.rating ?? ""])];
    const csv = rows.map((r: any) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `antri-pintar-${filterStart}.csv`; a.click();
  };

  // ===== GUARD RENDER (TETAP IDENTIK) =====
  if (checking) return <div className="min-h-screen grid place-items-center bg-slate-50"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 rounded-xl bg-emerald-700 grid place-items-center animate-pulse"><ShieldCheck className="w-6 h-6 text-white" /></div><p className="text-sm font-medium text-slate-500">Memverifikasi akses…</p></div></div>;
  if (!session) return <div className="min-h-screen grid place-items-center bg-slate-50 p-4"><div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full"><div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-xl grid place-items-center mx-auto mb-4"><ShieldAlert className="w-7 h-7" /></div><h2 className="text-lg font-bold text-slate-900">Login Diperlukan</h2><Link to="/login" className="mt-6 flex items-center justify-center gap-2 w-full bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-3 rounded-xl font-semibold transition">Login Admin</Link></div></div>;
  if (role !== "admin") return <div className="min-h-screen grid place-items-center bg-slate-50 p-4"><div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-rose-200 max-w-sm w-full"><div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-xl grid place-items-center mx-auto mb-4"><ShieldAlert className="w-7 h-7" /></div><h2 className="text-lg font-bold text-slate-900">Akses Ditolak</h2><p className="text-sm text-slate-500 mt-1 mb-6">Role kamu: <span className="font-semibold">{role || "tidak ada"}</span></p><button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }} className="flex items-center justify-center gap-2 w-full bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-3 rounded-xl font-semibold transition"><LogOut className="w-4 h-4" /> Ganti Akun</button></div></div>;

  const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 scroll-smooth">
      {/* ===== TOP BAR ===== */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 grid place-items-center text-slate-600 transition shrink-0"><ArrowLeft className="w-4 h-4" /></Link>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-800 grid place-items-center shrink-0"><Sparkles className="w-5 h-5 text-white" /></div>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight truncate">Antri Pintar</p>
                <p className="text-[11px] text-slate-500 leading-tight">Admin Console</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE</span>
            <button className="relative w-9 h-9 rounded-lg hover:bg-slate-100 grid place-items-center text-slate-500 transition"><Bell className="w-4 h-4" />{feedbacks.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />}</button>
            <div className="flex items-center gap-2 pl-1 sm:pl-2 sm:border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white grid place-items-center text-xs font-bold shrink-0">{(session.user?.email || "A").slice(0, 1).toUpperCase()}</div>
              <div className="hidden md:block leading-tight"><p className="text-xs font-semibold truncate max-w-[140px]">{session.user?.email}</p><p className="text-[10px] text-slate-400">Administrator</p></div>
            </div>
            <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg transition"><LogOut className="w-4 h-4" /><span className="hidden sm:inline">Keluar</span></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 lg:py-8 grid lg:grid-cols-[220px_1fr] gap-6 lg:gap-8">
        {/* ===== SIDEBAR NAV ===== */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Navigasi</p>
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-white hover:text-emerald-700 hover:shadow-sm transition">
                <n.icon className="w-4 h-4" />{n.label}
              </a>
            ))}
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-[11px] font-semibold text-emerald-800">Sinkronisasi</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Auto-refresh tiap 3 detik via realtime.</p>
            </div>
          </div>
        </aside>

        {/* ===== MAIN ===== */}
        <main className="space-y-6 lg:space-y-8 min-w-0">
          {/* Page head */}
          <div id="overview" className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Pintar Panel</h1>
              <p className="text-sm text-slate-500 mt-0.5">Monitoring real-time & laporan layanan loket.</p>
            </div>
            <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 px-3.5 py-2 rounded-lg shadow-sm transition"><Download className="w-4 h-4" />Ekspor CSV</button>
          </div>

          {/* Filter */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-slate-700"><Calendar className="w-4 h-4 text-emerald-600" /><span className="text-sm font-semibold">Periode Laporan</span><span className="text-[11px] text-slate-400">(WIT)</span></div>
              <span className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">{isTodayRange ? "Hari ini" : `${formatTanggal(filterStart)} — ${formatTanggal(filterEnd)}`}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
              <label className="block"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Dari</span><input type="date" value={filterStart} onChange={(e) => { const v = e.target.value; setFilterStart(v); if (v > filterEnd) setFilterEnd(v); }} max={today} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition" /></label>
              <span className="hidden sm:flex items-center pb-2 text-slate-300">→</span>
              <label className="block"><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Sampai</span><input type="date" value={filterEnd} onChange={(e) => { const v = e.target.value; setFilterEnd(v); if (v < filterStart) setFilterStart(v); }} max={today} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition" /></label>
              {!isTodayRange && <button onClick={() => { setFilterStart(today); setFilterEnd(today); }} className="text-xs font-semibold text-emerald-700 hover:bg-emerald-50 px-3 py-2 rounded-lg transition self-end">Reset</button>}
            </div>
          </section>

          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <Kpi icon={<Ticket className="w-5 h-5" />} tone="emerald" label="Total Periode" value={stats.total} sub="orang" />
            <Kpi icon={<Clock className="w-5 h-5" />} tone="amber" label="Menunggu" value={stats.waiting} sub="antrean" />
            <Kpi icon={<Activity className="w-5 h-5" />} tone="blue" label="Diproses" value={stats.called} sub="aktif" />
            <Kpi icon={<CheckCircle className="w-5 h-5" />} tone="teal" label="Selesai" value={stats.completed} sub={`${completionRate}% tuntas`} />
            <Kpi icon={<Star className="w-5 h-5" />} tone="violet" label="Rata-rata" value={stats.avgRating} sub="/ 5.0" highlight />
          </div>

          {/* Analytics + History */}
          <div className="grid lg:grid-cols-5 gap-6">
            <Card id="analytics" className="lg:col-span-2" icon={<TrendingUp className="w-4 h-4" />} title="Antrean per Layanan" sub={isTodayRange ? "Hari ini" : `${formatTanggal(filterStart)} — ${formatTanggal(filterEnd)}`}>
              <div className="space-y-4">
                {services.length === 0 ? <Empty icon={<Ticket className="w-5 h-5" />} text="Belum ada data di periode ini" /> : services.map((s: any) => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-sm mb-1.5"><span className="font-medium text-slate-700 capitalize">{s.name.replace(/_/g, " ")}</span><span className="text-slate-500 tabular-nums text-xs">{s.count} orang</span></div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-all duration-700" style={{ width: `${s.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </Card>

            <Card id="history" className="lg:col-span-3" icon={<Users className="w-4 h-4" />} title="Riwayat Antrean" sub={`${history.length} antrean di periode ini`}>
              <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0 z-10">
                    <tr><th className="text-left px-3 py-2.5 font-semibold">No</th><th className="text-left px-3 py-2.5 font-semibold">Nama</th><th className="text-left px-3 py-2.5 font-semibold">Status</th><th className="text-right px-3 py-2.5 font-semibold">Rating</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.length === 0 ? <tr><td colSpan={4} className="px-3 py-10 text-center text-sm text-slate-400">Belum ada riwayat.</td></tr> : history.map((h: any) => (
                      <tr key={h.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-3 py-2.5"><span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{h.queue_number}</span></td>
                        <td className="px-3 py-2.5 font-medium text-slate-700 truncate max-w-[160px]">{h.customer_name}</td>
                        <td className="px-3 py-2.5"><StatusPill status={h.status} /></td>
                        <td className="px-3 py-2.5 text-right"><Stars value={h.feedbacks?.[0]?.rating} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Feedback */}
          <Card id="feedback" icon={<MessageSquare className="w-4 h-4" />} title="Umpan Balik & Komentar Pelanggan" sub="Penilaian realtime dari antrean selesai" accent>
            {feedbacks.length === 0 ? <Empty icon={<MessageSquare className="w-5 h-5" />} text="Belum ada umpan balik di periode ini" /> : (
              <div className="grid sm:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
                {feedbacks.map((fb: any) => (
                  <div key={fb.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm transition">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0"><div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-bold shrink-0">{(fb.queue_number || "?").slice(-1)}</div><div className="min-w-0"><p className="text-sm font-semibold text-slate-800 truncate">Antrean {fb.queue_number}</p><p className="text-[11px] text-slate-400">{new Date(fb.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div></div>
                      <Stars value={fb.rating} />
                    </div>
                    {fb.comment ? <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 italic border-l-2 border-emerald-400">"{fb.comment}"</p> : <p className="text-xs text-slate-400 italic">Tanpa komentar</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}

/* ===== UI HELPERS (visual only) ===== */
const TONES: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600",
  blue: "bg-blue-50 text-blue-600", teal: "bg-teal-50 text-teal-600", violet: "bg-violet-50 text-violet-600",
};
function Kpi({ icon, tone, label, value, sub, highlight }: any) {
  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow ${highlight ? "border-emerald-300 ring-1 ring-emerald-500/20" : "border-slate-200"}`}>
      <div className={`w-9 h-9 rounded-lg grid place-items-center mb-3 ${TONES[tone] || TONES.emerald}`}>{icon}</div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-slate-900 mt-0.5 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}
function Card({ id, icon, title, sub, children, className = "", accent }: any) {
  return (
    <section id={id} className={`bg-white rounded-xl border ${accent ? "border-amber-200" : "border-slate-200"} shadow-sm p-5 sm:p-6 scroll-mt-20 ${className}`}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-8 h-8 rounded-lg grid place-items-center ${accent ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>{icon}</div>
        <div className="min-w-0"><h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>{sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}</div>
      </div>
      {children}
    </section>
  );
}
function StatusPill({ status }: { status: string }) {
  const m: Record<string, string> = { completed: "bg-teal-50 text-teal-700 border-teal-200", called: "bg-blue-50 text-blue-700 border-blue-200", skipped: "bg-slate-100 text-slate-500 border-slate-200", waiting: "bg-amber-50 text-amber-700 border-amber-200" };
  const l: Record<string, string> = { completed: "Selesai", called: "Diproses", skipped: "Dilewat", waiting: "Menunggu" };
  return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold border px-2 py-0.5 rounded-md ${m[status] || m.waiting}`}>{l[status] || status}</span>;
}
function Stars({ value }: { value?: number }) {
  if (!value) return <span className="text-xs text-slate-300">—</span>;
  return <div className="flex gap-0.5 justify-end">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-3.5 h-3.5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div>;
}
function Empty({ icon, text }: any) {
  return <div className="flex flex-col items-center gap-2 py-8 text-slate-400"><div className="w-11 h-11 rounded-xl bg-slate-100 grid place-items-center">{icon}</div><p className="text-sm">{text}</p></div>;
}
