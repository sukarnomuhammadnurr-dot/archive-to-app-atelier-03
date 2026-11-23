import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle, Volume2, Clock, Activity, LogOut, Zap, Ticket, RefreshCw, Search, ChevronsRight, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../integrations/supabase/client";

export const Route = createFileRoute("/petugas")({ component: Petugas });

type Status = "waiting" | "called" | "completed" | "skipped";
type QueueItem = { id: string; queue_number: string; customer_name: string; customer_id: string | null; contact: string | null; service_type: string; status: Status; loket?: string | null; created_at: string; called_at?: string | null; completed_at?: string | null };

const PAGE_SIZE = 5;
const TZ = "Asia/Jayapura";
const getTodayWIT = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

function Wave() {
  return (<svg viewBox="0 0 400 42" preserveAspectRatio="none" className="absolute bottom-[-1px] left-0 w-full h-10 block"><path fill="#F6F8F5" d="M0,22 C90,44 150,4 220,18 C290,32 340,8 400,22 L400,42 L0,42 Z" /></svg>);
}

function Petugas() {
  const navigate = useNavigate();
  const loket = "1";
  const today = getTodayWIT();
  const [session, setSession] = useState<any>(null);
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [filterStart, setFilterStart] = useState(today);
  const [filterEnd, setFilterEnd] = useState(today);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => { setSession(s); setLoading(false); });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const fetchQueues = async () => {
    if (!session) return;
    const { data } = await supabase.from("queues").select("*").gte("created_at", `${filterStart}T00:00:00`).lte("created_at", `${filterEnd}T23:59:59`).order("created_at", { ascending: true });
    if (data) setQueues(data as QueueItem[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!session) return;
    fetchQueues();
    const ch = supabase.channel("public:queues").on("postgres_changes", { event: "*", schema: "public", table: "queues" }, fetchQueues).subscribe();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [session, filterStart, filterEnd]);

  const suaraPanggilan = (nomor: string, nama: string, lk: string = loket) => {
    if (!("speechSynthesis" in window)) return;
    const teks = `Nomor antrean ${nomor.replace("-", " ").replace(/0/g, "nol ")}, atas nama ${nama}, silahkan pergi ke loket NPWP ${lk}.`;
    const s = new SpeechSynthesisUtterance(teks); s.lang = "id-ID"; s.rate = 0.85;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(s);
  };

  const updateStatus = async (id: string, newStatus: Status, nomor: string, nama: string, lk: string = loket) => {
    const patch: any = { status: newStatus, loket: lk };
    if (newStatus === "completed") patch.completed_at = new Date().toISOString();
    if (newStatus === "called") patch.called_at = new Date().toISOString();
    const { error } = await supabase.from("queues").update(patch).eq("id", id);
    if (!error) { if (newStatus === "called") suaraPanggilan(nomor, nama, lk); fetchQueues(); }
  };

  const callNext = () => { const next = queues.find(q => q.status === "waiting"); if (next) updateStatus(next.id, "called", next.queue_number, next.customer_name); };

  const waiting = queues.filter(q => q.status === "waiting");
  const current = queues.find(q => q.status === "called");
  const completed = queues.filter(q => q.status === "completed");
  const skipped = queues.filter(q => q.status === "skipped");

  const avgMin = useMemo(() => {
    const withTime = completed.filter(q => q.completed_at && q.created_at);
    if (!withTime.length) return "0";
    const total = withTime.reduce((s, q) => s + (new Date(q.completed_at!).getTime() - new Date(q.created_at).getTime()) / 60000, 0);
    return (total / withTime.length).toFixed(1);
  }, [completed]);

  const counts = { all: queues.length, waiting: waiting.length, completed: completed.length, skipped: skipped.length };
  const visible = useMemo(() => {
    let list = filter === "all" ? queues : queues.filter(q => q.status === filter);
    if (search.trim()) { const s = search.toLowerCase(); list = list.filter(q => q.customer_name?.toLowerCase().includes(s) || q.queue_number?.toLowerCase().includes(s)); }
    return list;
  }, [queues, filter, search]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const maskNik = (nik?: string | null) => nik && nik.length >= 8 ? `${nik.slice(0, 4)}${"*".repeat(nik.length - 8)}${nik.slice(-4)}` : "—";
  const serviceBadge = (type: string) => type.toUpperCase().includes("NPWP") ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-slate-50 text-slate-700 border-slate-200";
  
  const statusBadge = (q: QueueItem) => {
    const lk = q.loket || loket;
    if (q.status === "called") return <span className="inline-flex items-center gap-1.5 bg-[#4A7C2F] text-white px-2.5 py-1 rounded-md text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />Loket {lk}</span>;
    if (q.status === "waiting") return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md text-xs font-semibold">Menunggu</span>;
    if (q.status === "completed") return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-semibold">Selesai</span>;
    return <span className="bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-md text-xs font-semibold">Dilewat</span>;
  };

  const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ });
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
  const waitMin = current?.created_at ? Math.max(0, Math.round((now.getTime() - new Date(current.created_at).getTime()) / 60000)) : null;
  const isTodayRange = filterStart === today && filterEnd === today;
  const formatWaktu = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F6F8F5]"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-[#4A7C2F] flex items-center justify-center animate-pulse"><Ticket className="w-6 h-6 text-white" /></div><p className="text-sm font-semibold text-slate-500">Memuat dashboard…</p></div></div>;
  if (!session) return <div className="min-h-screen flex items-center justify-center bg-[#F6F8F5] p-4"><div className="text-center p-8 bg-white rounded-3xl shadow-xl border border-[#4A7C2F]/10 max-w-sm w-full"><div className="w-16 h-16 bg-[#4A7C2F]/10 text-[#4A7C2F] rounded-2xl flex items-center justify-center mx-auto mb-4"><LogOut className="w-8 h-8" /></div><h2 className="text-xl font-extrabold text-slate-800">Akses Ditolak</h2><p className="text-sm text-slate-500 mt-2 mb-6">Silakan login terlebih dahulu.</p><Link to="/login" className="inline-flex items-center justify-center gap-2 w-full bg-[#4A7C2F] hover:bg-[#3d6826] text-white px-6 py-3.5 rounded-2xl font-bold transition active:scale-95">Login Petugas</Link></div></div>;

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
                <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-white">Dashboard Petugas</h1>
                <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/25 text-white text-[11px] font-bold px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-lime-300 animate-pulse" />LIVE</span>
              </div>
              <p className="text-[12px] text-white/70 mt-0.5 truncate">Loket {loket} • {session.user?.email || "Petugas"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="text-right hidden sm:block mr-1">
              <p className="text-[11px] text-white/60 capitalize leading-none">{dateStr}</p>
              <p className="text-sm font-bold text-white tabular-nums mt-1">{timeStr} WIT</p>
            </div>
            <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }} className="flex items-center gap-2 text-[13px] font-semibold text-[#4A7C2F] bg-white hover:bg-slate-50 px-3.5 py-2.5 rounded-xl transition active:scale-95 shadow-sm"><LogOut className="w-4 h-4" /> Keluar</button>
          </div>
        </div>
        <Wave />
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 -mt-4 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <Stat icon={<Ticket className="w-5 h-5" />} tint="slate" label="Total Tiket" value={queues.length} unit="orang" />
          <Stat icon={<Activity className="w-5 h-5" />} tint="brand" label="Aktif Dipanggil" value={current?.queue_number || "—"} big highlight />
          <Stat icon={<Clock className="w-5 h-5" />} tint="amber" label="Sisa Menunggu" value={waiting.length} unit="antrean" />
          <Stat icon={<CheckCircle className="w-5 h-5" />} tint="emerald" label="Telah Selesai" value={completed.length} unit="selesai" />
          <Stat icon={<Zap className="w-5 h-5" />} tint="violet" label="Rerata Layanan" value={`${avgMin}`} unit="menit" />
        </div>

        <section className="relative rounded-3xl bg-gradient-to-br from-[#4A7C2F] to-[#3a6224] shadow-xl shadow-[#4A7C2F]/25 p-6 md:p-7 overflow-hidden">
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
          {current ? (
            <div className="relative flex flex-col lg:flex-row items-center gap-6">
              <div className="bg-white/10 border border-white/20 rounded-2xl px-7 py-5 text-center shrink-0 backdrop-blur">
                <p className="text-[10px] font-bold tracking-widest text-white/60 uppercase">Nomor Antrean</p>
                <p className="text-5xl md:text-6xl font-black leading-tight text-white tracking-tight mt-1">{current.queue_number}</p>
                <p className="text-[11px] text-white/60 font-semibold mt-1">Loket {loket}</p>
              </div>
              <div className="min-w-0 flex-1 text-center lg:text-left">
                <span className="inline-flex items-center gap-1.5 bg-lime-300/20 border border-lime-300/30 text-lime-100 text-[11px] font-bold px-2.5 py-1 rounded-full mb-2"><span className="w-1.5 h-1.5 rounded-full bg-lime-300 animate-pulse" />Sedang Dipanggil</span>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white truncate">{current.customer_name}</h2>
                <div className="flex items-center justify-center lg:justify-start gap-2 mt-2 flex-wrap text-[13px] text-white/70">
                  <span className="bg-white/10 border border-white/15 rounded-lg px-2.5 py-1 font-semibold text-white">{current.service_type}</span>
                  <span>•</span><span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Tunggu {waitMin ?? 0} mnt</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:flex-col">
                <button onClick={() => suaraPanggilan(current.queue_number, current.customer_name)} className="flex-1 lg:w-full flex items-center justify-center gap-2 bg-white text-[#4A7C2F] hover:bg-slate-50 px-5 py-3 rounded-xl font-bold transition active:scale-95 text-sm shadow-lg"><Volume2 className="w-4 h-4" /> Panggil</button>
                {/* 🔥 TOMBOL SELESAI YANG MENGGUNAKAN updateStatus */}
                <button onClick={() => updateStatus(current.id, "completed", current.queue_number, current.customer_name)} className="flex-1 lg:w-full flex items-center justify-center gap-2 bg-lime-400 text-[#2d4a1c] hover:bg-lime-300 px-5 py-3 rounded-xl font-bold transition active:scale-95 text-sm shadow-lg"><CheckCircle className="w-4 h-4" /> Selesai</button>
                <button onClick={() => updateStatus(current.id, "skipped", current.queue_number, current.customer_name)} className="w-12 h-12 flex items-center justify-center bg-white/10 border border-white/20 hover:bg-white/20 text-white rounded-xl transition active:scale-95 shrink-0"><ChevronsRight className="w-4 h-4" /></button>
              </div>
            </div>
          ) : (
            <div className="relative flex flex-col items-center text-center py-4">
              <div className="w-20 h-20 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center mb-4"><Volume2 className="w-9 h-9 text-white/80" /></div>
              <h2 className="text-2xl font-extrabold text-white">Belum ada antrean dipanggil</h2>
              <p className="text-sm text-white/60 mt-1 mb-5">Mulai panggil antrean pertama untuk hari ini.</p>
              <button onClick={callNext} disabled={!waiting.length} className="flex items-center gap-2 bg-white text-[#4A7C2F] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3.5 rounded-2xl font-bold text-sm transition active:scale-95 shadow-lg"><Volume2 className="w-4 h-4" /> Panggil Berikutnya ({waiting[0]?.queue_number || "—" })</button>
            </div>
          )}
        </section>

        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Daftar Antrean</h2>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Calendar className="w-3 h-3" />{isTodayRange ? "Hari ini" : `${filterStart} — ${filterEnd}`}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([["all", "Semua"], ["waiting", "Menunggu"], ["completed", "Selesai"], ["skipped", "Dilewat"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => { setFilter(k); setPage(0); }} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${filter === k ? "bg-[#4A7C2F] text-white border-[#4A7C2F] shadow-md shadow-[#4A7C2F]/25" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>{label} ({counts[k]})</button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Cari nama atau nomor tiket..." className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#4A7C2F]/20 focus:border-[#4A7C2F] outline-none transition" />
            </div>
            <button onClick={callNext} disabled={!waiting.length} className="flex items-center justify-center gap-2 bg-[#4A7C2F] hover:bg-[#3d6826] disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-bold text-sm transition active:scale-95 shadow-md shadow-[#4A7C2F]/25"><Volume2 className="w-4 h-4" /> Panggil Berikutnya</button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-[#4A7C2F]/5 text-[#4A7C2F] text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">No. Tiket</th>
                  <th className="text-left px-4 py-3 font-bold">Nama Pengunjung</th>
                  <th className="text-left px-4 py-3 font-bold">Layanan</th>
                  <th className="text-left px-4 py-3 font-bold">Waktu (WIT)</th>
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                  <th className="text-right px-4 py-3 font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center"><p className="text-sm font-semibold text-slate-400">Tidak ada data antrean</p></td></tr>
                ) : paged.map(q => (
                  <tr key={q.id} className="hover:bg-[#4A7C2F]/[0.03] transition">
                    <td className="px-4 py-3"><span className="bg-[#4A7C2F]/10 text-[#4A7C2F] font-bold px-2.5 py-1 rounded-lg text-xs">{q.queue_number}</span></td>
                    <td className="px-4 py-3"><p className="font-bold text-slate-800">{q.customer_name}</p><p className="text-xs text-slate-400">ID: {maskNik(q.customer_id)}</p></td>
                    <td className="px-4 py-3"><span className={`border px-2.5 py-1 rounded-lg text-xs font-bold ${serviceBadge(q.service_type)}`}>{q.service_type}</span></td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums text-xs">{q.created_at ? formatWaktu(q.created_at) : "—" } WIT</td>
                    <td className="px-4 py-3">{statusBadge(q)}</td>
                    <td className="px-4 py-3 text-right">
                      {q.status === "called" && <button onClick={() => suaraPanggilan(q.queue_number, q.customer_name)} className="inline-flex items-center gap-1.5 text-[#4A7C2F] hover:bg-[#4A7C2F]/10 font-bold text-xs border border-[#4A7C2F]/30 rounded-lg px-3 py-1.5 transition"><Volume2 className="w-3.5 h-3.5" />Panggil Ulang</button>}
                      {(q.status === "waiting" || q.status === "skipped") && <button onClick={() => updateStatus(q.id, "called", q.queue_number, q.customer_name)} className="inline-flex items-center gap-1.5 bg-[#4A7C2F] hover:bg-[#3d6826] text-white font-bold text-xs rounded-lg px-3 py-1.5 transition active:scale-95"><Volume2 className="w-3.5 h-3.5" />Panggil</button>}
                      {q.status === "completed" && <span className="text-xs text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
            <span>Menampilkan {visible.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, visible.length)} dari {visible.length} antrean</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0} className="flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 transition"><ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1} className="flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 transition">Selanjutnya <ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, tint, label, value, unit, big, highlight }: { icon: React.ReactNode, tint: string, label: string, value: string | number, unit?: string, big?: boolean, highlight?: boolean }) {
  const map: Record<string, string> = { slate: "bg-slate-100 text-slate-600", brand: "bg-[#4A7C2F]/10 text-[#4A7C2F]", blue: "bg-blue-50 text-blue-600", amber: "bg-amber-50 text-amber-600", emerald: "bg-emerald-50 text-emerald-600", violet: "bg-violet-50 text-violet-600" };
  return (
    <div className={`bg-white p-4 md:p-5 rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${highlight ? "border-[#4A7C2F]/30 ring-1 ring-[#4A7C2F]/20 bg-[#4A7C2F]/[0.04]" : "border-slate-100 hover:border-[#4A7C2F]/20"}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mb-3 ${map[tint] || map["slate"]}`}>{icon}</div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{label}</p>
      <p className={`font-black text-slate-800 leading-tight mt-0.5 ${big ? "text-xl" : "text-2xl"} tabular-nums`}>{value} {unit && !big && <span className="text-[11px] font-semibold text-slate-400 ml-0.5">{unit}</span>}</p>
    </div>
  );
}
