import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Ticket, User, CreditCard, Phone, ChevronDown, Check, Loader2,
  Clock, MapPin, ShieldCheck, ArrowRight, Sparkles, X, Home,
  History, Star, Trash2, Calendar, AlertCircle, Volume2, CheckCircle,
  Eye, MessageSquare, Hash, Phone as PhoneIcon, Timer
} from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../integrations/supabase/client";
import FeedbackForm from "../components/ui/FeedbackForm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Antri Pintar | Sistem Antrean Loket" },
      { name: "description", content: "Ambil tiket dan pantau antrean layanan loket melalui Antri Pintar." },
    ],
  }),
  component: Index,
});

const TZ = "Asia/Jayapura"; // WIT - Maluku Utara
const SERVICES = [
  { value: "NPWP", label: "NPWP", desc: "Nomor Pokok Wajib Pajak", color: "bg-indigo-500" },
  { value: "BP", label: "BP", desc: "Berkas Pensiun", color: "bg-sky-500" },
  { value: "HR", label: "HR", desc: "Human Resources", color: "bg-violet-500" },
  { value: "BPJS", label: "BPJS", desc: "Kesehatan", color: "bg-emerald-500" },
];

type HistoryItem = {
  id: string;
  queue_number: string;
  customer_name: string;
  customer_id?: string | null;
  contact?: string | null;
  service_type: string;
  status: string;
  created_at: string;
  called_at?: string | null;
  completed_at?: string | null;
  finishedAt?: string;
  rated?: boolean;
  rating?: number;
  comment?: string;
};

function Wave() {
  return (
    <svg viewBox="0 0 400 42" preserveAspectRatio="none" className="absolute bottom-[-1px] left-0 w-full h-10 block">
      <path fill="#F6F8F5" d="M0,22 C90,44 150,4 220,18 C290,32 340,8 400,22 L400,42 L0,42 Z" />
    </svg>
  );
}

function Index() {
  const [activeTab, setActiveTab] = useState<"home" | "riwayat">("home");
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<any>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [form, setForm] = useState({ nama: "", nik: "", kontak: "", layanan: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasFeedback, setHasFeedback] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("queue_history");
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("current_ticket");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTicket(parsed.ticket);
        setPosition(parsed.position);
      } catch {
        localStorage.removeItem("current_ticket");
      }
    }
  }, []);

  useEffect(() => {
    if (ticket) localStorage.setItem("current_ticket", JSON.stringify({ ticket, position }));
    else localStorage.removeItem("current_ticket");
  }, [ticket, position]);

  // POLLING STATUS via VIEW
  useEffect(() => {
    if (!ticket?.id) return;
    let active = true;
    const check = async () => {
      const { data } = await supabase
        .from("public_queue_view")
        .select("status, completed_at, called_at")
        .eq("id", ticket.id)
        .single();
      if (!active || !data) return;
      setTicket((prev: any) =>
        prev ? { ...prev, status: data.status, completed_at: data.completed_at, called_at: data.called_at } : prev
      );
    };
    check();
    const iv = setInterval(check, 4000);
    return () => { active = false; clearInterval(iv); };
  }, [ticket?.id]);

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.nama.trim()) errs["nama"] = "Nama wajib diisi";
    if (!form.nik.trim()) errs["nik"] = "NIK wajib diisi";
    if (!form.layanan) errs["layanan"] = "Pilih layanan";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    const { data, error } = await supabase.rpc("submit_queue", {
      p_customer_name: form.nama,
      p_customer_id: form.nik,
      p_contact: form.kontak || "",
      p_service_type: form.layanan,
    });

    setLoading(false);
    if (error) {
      setErrors({ form: error.message });
    } else {
      setPosition((data as any)?.position ?? null);
      setTicket(data);
      setHasFeedback(false);
      setActiveTab("home");
    }
  };

  const saveToHistory = (t: any, ratingData?: { rating?: number; comment?: string }) => {
    const newItem: HistoryItem = {
      id: t.id,
      queue_number: t.queue_number,
      customer_name: t.customer_name,
      customer_id: t.customer_id,
      contact: t.contact,
      service_type: t.service_type,
      status: t.status,
      created_at: t.created_at,
      called_at: t.called_at,
      completed_at: t.completed_at,
      finishedAt: new Date().toISOString(),
      rated: hasFeedback || !!ratingData?.rating,
      ...(ratingData?.rating !== undefined ? { rating: ratingData.rating } : {}),
      ...(ratingData?.comment !== undefined ? { comment: ratingData.comment } : {}),
    };
    const updated = [...history, newItem].slice(-30);
    setHistory(updated);
    localStorage.setItem("queue_history", JSON.stringify(updated));
  };

  const updateHistoryItem = (id: string, patch: Partial<HistoryItem>) => {
    const updated = history.map(h => h.id === id ? { ...h, ...patch } : h);
    setHistory(updated);
    localStorage.setItem("queue_history", JSON.stringify(updated));
  };

  const reset = () => {
    if (ticket) saveToHistory(ticket);
    setTicket(null);
    setHasFeedback(false);
    setForm({ nama: "", nik: "", kontak: "", layanan: "" });
    setErrors({});
    setPosition(null);
  };

  const clearHistory = () => {
    if (confirm("Hapus semua riwayat antrean?")) {
      setHistory([]);
      localStorage.removeItem("queue_history");
    }
  };

  const handleFeedbackSuccess = (rating: number, comment: string) => {
    setHasFeedback(true);
    if (ticket) {
      saveToHistory(ticket, { rating, comment });
    }
    alert("Terima kasih atas penilaian Anda! ⭐");
  };

  return (
    <div className="relative min-h-screen bg-[#F6F8F5] flex flex-col overflow-hidden">
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}@keyframes draw{to{stroke-dashoffset:0}}circle[class*="draw"],path[class*="draw"]{stroke-dasharray:120;stroke-dashoffset:120}`}</style>

      <div className="flex-1 overflow-y-auto pb-24">
        {activeTab === "home" ? (
          <div className="flex items-center justify-center p-4 min-h-full">
            <div className="relative w-full max-w-[420px] space-y-6">
              {ticket ? (
                <>
                  <TicketCard ticket={ticket} position={position} onReset={reset} />
                  {ticket.status === "completed" && !hasFeedback && (
                    <FeedbackForm
                      queueId={ticket.id}
                      onSuccess={(rating, comment) => handleFeedbackSuccess(rating, comment)}
                    />
                  )}
                </>
              ) : (
                <FormCard form={form} updateForm={updateForm} errors={errors} loading={loading} onSubmit={handleSubmit} />
              )}
            </div>
          </div>
        ) : (
          <HistoryView
            history={history}
            onClear={clearHistory}
            onViewDetail={(item) => setSelectedItem(item)}
          />
        )}
      </div>

      {/* MODAL DETAIL */}
      {selectedItem && typeof document !== "undefined" && createPortal(
        <HistoryDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />,
        document.body
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2">
          <NavBtn icon={<Home className="w-5 h-5" />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
          <NavBtn icon={<History className="w-5 h-5" />} label="Riwayat" badge={history.length > 0 ? history.length : undefined} active={activeTab === "riwayat"} onClick={() => setActiveTab("riwayat")} />
        </div>
      </nav>
    </div>
  );
}

/* ===================== HISTORY DETAIL MODAL ===================== */
function HistoryDetailModal({ item, onClose }: { item: HistoryItem; onClose: () => void }) {
  const svc = SERVICES.find(s => s.value === item.service_type);
  const overlayRef = useRef<HTMLDivElement>(null);

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: TZ
    }) + " WIT";
  };

  const getDuration = () => {
    if (!item.completed_at || !item.created_at) return null;
    const diff = (new Date(item.completed_at).getTime() - new Date(item.created_at).getTime()) / 60000;
    if (diff < 1) return `${Math.round(diff * 60)} detik`;
    const m = Math.floor(diff);
    const s = Math.round((diff - m) * 60);
    return s > 0 ? `${m} mnt ${s} dtk` : `${m} menit`;
  };

  const maskNik = (nik?: string | null) =>
    nik && nik.length >= 8 ? `${nik.slice(0, 4)}${"*".repeat(nik.length - 8)}${nik.slice(-4)}` : (nik || "—");

  const statusConfig = {
    waiting: { label: "MENUNGGU", bg: "bg-amber-100", text: "text-amber-700" },
    called: { label: "DIPANGGIL", bg: "bg-blue-100", text: "text-blue-700" },
    completed: { label: "SELESAI", bg: "bg-emerald-100", text: "text-emerald-700" },
    skipped: { label: "DILEWAT", bg: "bg-slate-100", text: "text-slate-600" },
  };
  const sc = statusConfig[item.status as keyof typeof statusConfig] || statusConfig.waiting;
  const duration = getDuration();

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-[fadeUp_.2s_ease]"
    >
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto animate-[fadeUp_.3s_ease]">
        {/* HEADER */}
        <div className="relative bg-[#4A7C2F] px-6 pt-6 pb-14 text-center rounded-t-3xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 border border-white/25">
            <Ticket className="h-7 w-7 text-white" />
          </div>
          <p className="text-[11px] font-bold tracking-widest text-white/60 uppercase">Nomor Antrean</p>
          <p className="text-5xl font-black text-white tracking-tight mt-1">{item.queue_number}</p>
          <div className="mt-3 flex justify-center">
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${sc.bg} ${sc.text}`}>
              {sc.label}
            </span>
          </div>
          <Wave />
        </div>

        {/* BODY */}
        <div className="px-6 pb-6 -mt-6 relative">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-lg p-4 mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Informasi Pengunjung</h3>
            <div className="space-y-3">
              <InfoRow icon={<User className="w-4 h-4" />} label="Nama" value={item.customer_name} />
              {item.customer_id && (
                <InfoRow icon={<Hash className="w-4 h-4" />} label="NIK / ID" value={maskNik(item.customer_id)} />
              )}
              {item.contact && (
                <InfoRow icon={<PhoneIcon className="w-4 h-4" />} label="Kontak" value={item.contact} />
              )}
              {svc && (
                <InfoRow
                  icon={<MapPin className="w-4 h-4" />}
                  label="Layanan"
                  value={
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${svc.color}`} />
                      <span className="font-semibold text-slate-700">{svc.label}</span>
                      <span className="text-xs text-slate-400">— {svc.desc}</span>
                    </div>
                  }
                />
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-lg p-4 mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Waktu & Durasi</h3>
            <div className="space-y-3">
              <InfoRow icon={<Calendar className="w-4 h-4" />} label="Diambil" value={formatDateTime(item.created_at)} />
              {item.called_at && (
                <InfoRow icon={<Volume2 className="w-4 h-4" />} label="Dipanggil" value={formatDateTime(item.called_at)} />
              )}
              {item.completed_at && (
                <InfoRow icon={<CheckCircle className="w-4 h-4" />} label="Selesai" value={formatDateTime(item.completed_at)} />
              )}
              {duration && (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-[#4A7C2F]/10 text-[#4A7C2F] flex items-center justify-center shrink-0">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-400 uppercase">Durasi Layanan</p>
                    <p className="text-sm font-bold text-slate-800">{duration}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {item.rated && item.rating && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 p-4">
              <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> Penilaian Anda
              </h3>
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`w-6 h-6 ${n <= item.rating! ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                  />
                ))}
                <span className="ml-2 text-sm font-bold text-amber-700">{item.rating}/5</span>
              </div>
              {item.comment && (
                <div className="mt-3 pt-3 border-t border-amber-200/60">
                  <p className="text-[11px] font-bold text-amber-700 uppercase mb-1.5 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Komentar
                  </p>
                  <p className="text-sm text-slate-700 italic bg-white/60 rounded-xl p-3">"{item.comment}"</p>
                </div>
              )}
            </div>
          )}

          {!item.rated && item.status === "completed" && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-center">
              <p className="text-sm text-slate-500">
                Anda belum memberikan penilaian untuk antrean ini.
              </p>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full mt-4 rounded-2xl bg-[#4A7C2F] hover:bg-[#3d6826] text-white font-bold py-3.5 transition active:scale-[.98]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-[11px] font-bold text-slate-400 uppercase">{label}</p>
        <div className="text-sm text-slate-800 font-semibold break-words">{value}</div>
      </div>
    </div>
  );
}

/* ===================== BOTTOM NAV ===================== */
function NavBtn({ icon, label, active, onClick, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all active:scale-95 ${
        active ? "text-[#4A7C2F]" : "text-slate-400 hover:text-slate-600"
      }`}
    >
      {active && <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#4A7C2F]" />}
      <div className={`relative ${active ? "bg-[#4A7C2F]/10" : ""} p-2 rounded-xl transition`}>
        {icon}
        {badge && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-[#4A7C2F] text-white text-[10px] font-bold flex items-center justify-center px-1">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}

/* ===================== FORM CARD ===================== */
function FormCard({ form, updateForm, errors, loading, onSubmit }: any) {
  return (
    <div className="animate-[fadeUp_.5s_ease] rounded-[32px] bg-white shadow-[0_24px_70px_-30px_rgba(20,40,30,.25)] border border-[#4A7C2F]/10 overflow-hidden">
      <div className="relative bg-[#4A7C2F] px-7 pt-10 pb-16 text-center overflow-hidden">
        <div className="relative mx-auto mb-3 h-16 w-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
          <Ticket className="h-8 w-8 text-white" />
        </div>
        <h1 className="relative text-2xl font-extrabold tracking-tight text-white">Antri Pintar</h1>
        <p className="relative mt-1 text-[13px] text-white/70">Sistem Pelayanan Loket Cepat & Modern</p>
        <Wave />
      </div>

      <div className="px-7 pt-3 pb-7">
        <h2 className="text-[22px] leading-tight font-extrabold tracking-tight text-slate-800">
          Let's get you
          <br />
          <span className="italic text-[#4A7C2F]">Antrean cepat</span>
        </h2>
        <p className="mt-2 mb-5 text-[13px] text-slate-400">Isi data diri untuk mengambil nomor antrean</p>

        <form onSubmit={onSubmit} className="space-y-3.5">
          <Input label="Nama Lengkap" icon={<User className="h-4 w-4" />} error={errors.nama}>
            <input value={form.nama} onChange={e => updateForm("nama", e.target.value)} placeholder="Masukkan nama lengkap" className="w-full bg-transparent outline-none text-[15px] text-slate-800 placeholder:text-slate-400" />
          </Input>
          <Input label="NIK / Nomor ID" icon={<CreditCard className="h-4 w-4" />} error={errors.nik}>
            <input value={form.nik} onChange={e => updateForm("nik", e.target.value)} placeholder="Masukkan NIK atau ID" className="w-full bg-transparent outline-none text-[15px] text-slate-800 placeholder:text-slate-400" />
          </Input>
          <Input label="Nomor Kontak" icon={<Phone className="h-4 w-4" />} optional>
            <input type="tel" value={form.kontak} onChange={e => updateForm("kontak", e.target.value)} placeholder="Contoh: 08123456789" className="w-full bg-transparent outline-none text-[15px] text-slate-800 placeholder:text-slate-400" />
          </Input>
          <ServiceSelect value={form.layanan} onChange={v => updateForm("layanan", v)} error={errors.layanan} />

          {errors.form && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-center">{errors.form}</p>}

          <button type="submit" disabled={loading}
            className="group relative w-full mt-1 rounded-2xl bg-[#4A7C2F] hover:bg-[#3d6826] px-5 py-4 text-white font-bold text-[15px] shadow-lg shadow-[#4A7C2F]/30 transition-all active:scale-[.98] disabled:opacity-60 disabled:active:scale-100 flex items-center justify-between">
            <span className="flex items-center gap-2">
              {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Memproses…</> : <><Sparkles className="h-5 w-5" /> Ambil Antrean</>}
            </span>
            {!loading && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Atau</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <div className="text-center">
          <Link to="/petugas" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-[#4A7C2F] transition-colors">
            <ShieldCheck className="h-4 w-4" /> Petugas? Masuk Dashboard <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Input({ label, icon, error, optional, children }: any) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
        {optional && <span className="text-[10px] text-slate-400">opsional</span>}
      </div>
      <div className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-sm transition-all ${error ? "border-red-300 ring-2 ring-red-100" : "border-slate-200 focus-within:border-[#4A7C2F] focus-within:ring-2 focus-within:ring-[#4A7C2F]/20"}`}>
        <span className="text-slate-400 shrink-0">{icon}</span>
        {children}
      </div>
      {error && <p className="mt-1 px-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

function ServiceSelect({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxH: 280 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = SERVICES.find(s => s.value === value);

  const updatePos = useCallback(() => {
    const btn = btnRef.current; if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const margin = 12;
    const width = Math.min(Math.max(r.width, 200), vw - margin * 2);
    const left = Math.min(Math.max(r.left, margin), vw - width - margin);
    const below = vh - r.bottom - margin;
    const above = r.top - margin;
    const need = 280;
    const openUp = below < need && above > below;
    const maxH = Math.max(140, Math.min(need, openUp ? above : below));
    setPos({ top: openUp ? r.top - maxH - 8 : r.bottom + 8, left, width, maxH });
  }, []);

  useEffect(() => { if (isOpen) updatePos(); }, [isOpen, updatePos]);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    const reposition = () => updatePos();
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen, updatePos]);

  const handleSelect = (val: string) => { onChange(val); setTimeout(() => setIsOpen(false), 0); };

  return (
    <div>
      <label className="mb-1.5 block px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Pilih Layanan</label>
      <button ref={btnRef} type="button" onClick={() => setIsOpen(o => !o)}
        className={`flex w-full items-center justify-between rounded-2xl border bg-white px-4 py-3.5 text-left shadow-sm transition-all ${error ? "border-red-300 ring-2 ring-red-100" : "border-slate-200"} ${isOpen ? "border-[#4A7C2F] ring-2 ring-[#4A7C2F]/20" : ""}`}>
        <span className={`text-[15px] ${selected ? "text-slate-800 font-semibold" : "text-slate-400"}`}>
          {selected ? selected.label : "-- Pilih Layanan --"}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div ref={listRef}
          className="z-[9999] rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 animate-[pop_.18s_ease] overflow-y-auto"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH, overscrollBehavior: "contain" }}>
          <div className="p-1.5">
            {SERVICES.map(s => {
              const isActive = value === s.value;
              return (
                <button key={s.value} type="button" onClick={() => handleSelect(s.value)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${isActive ? "bg-[#4A7C2F]/10" : "hover:bg-slate-50"}`}>
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.color}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-bold text-slate-800">{s.label}</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">{s.desc}</span>
                  </span>
                  {isActive && <Check className="h-4 w-4 text-[#4A7C2F] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
      {error && <p className="mt-1 px-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

/* ===================== TICKET CARD ===================== */
function TicketCard({ ticket, position, onReset }: any) {
  const svc = SERVICES.find(s => s.value === ticket.service_type);
  const status = ticket.status;
  const time = ticket.created_at
    ? new Date(ticket.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: TZ })
    : new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

  const header =
    status === "completed"
      ? { icon: <CheckCircle className="h-9 w-9 text-white" />, title: "Pelayanan Selesai!", sub: "Silakan beri penilaian untuk kami" }
      : status === "called"
      ? { icon: <Volume2 className="h-9 w-9 text-white" />, title: "Nomor Anda Dipanggil!", sub: "Silakan menuju loket sekarang" }
      : { icon: <Check className="h-9 w-9 text-white" />, title: "Antrean Berhasil!", sub: "Silakan menunggu nomor Anda dipanggil" };

  return (
    <div className="animate-[fadeUp_.5s_ease] rounded-[32px] bg-white shadow-[0_24px_70px_-30px_rgba(20,40,30,.25)] border border-[#4A7C2F]/10 overflow-hidden">
      <div className="relative bg-[#4A7C2F] px-7 pt-10 pb-16 text-center overflow-hidden">
        <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 border border-white/25">
          {header.icon}
        </div>
        <h2 className="relative text-xl font-extrabold text-white">{header.title}</h2>
        <p className="relative mt-1 text-[13px] text-white/70">{header.sub}</p>
        <Wave />
      </div>

      <div className="px-7 pt-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 py-5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Nomor Antrean</p>
          <p className="mt-1 text-6xl font-black tracking-tighter text-[#4A7C2F]">{ticket.queue_number}</p>
        </div>
      </div>

      <div className="relative my-6 h-px border-t-2 border-dashed border-slate-200 mx-7">
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-3 text-[10px] font-bold tracking-widest text-slate-300">TIKET</span>
      </div>

      <div className="px-7 flex items-center justify-between gap-4">
        <div className="space-y-2 text-[13px]">
          <Row icon={<User className="h-3.5 w-3.5" />} label="Nama" value={ticket.customer_name} />
          <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Layanan" value={svc ? `${svc.label} — ${svc.desc}` : ticket.service_type} />
          <Row icon={<Clock className="h-3.5 w-3.5" />} label="Waktu" value={`${time} WIT`} />
          {position != null && status === "waiting" && <Row icon={<Sparkles className="h-3.5 w-3.5" />} label="Posisi" value={`Antrean ke-${position}`} accent />}
        </div>
        <QrVisual seed={ticket.queue_number} />
      </div>

      <p className="px-7 mt-5 text-center text-[11px] text-slate-400">Tunjukkan kode ini saat dipanggil di loket.</p>

      <div className="px-6 pb-6 pt-5">
        <button onClick={onReset} className="w-full rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 text-[15px] transition-all active:scale-[.98] flex items-center justify-center gap-2">
          <X className="h-4 w-4" /> Selesai / Antrean Baru
        </button>
      </div>
    </div>
  );
}

function Row({ icon, label, value, accent }: any) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-400">{label}:</span>
      <span className={`font-semibold ${accent ? "text-[#4A7C2F]" : "text-slate-700"}`}>{value}</span>
    </div>
  );
}

function QrVisual({ seed }: { seed: string }) {
  const size = 11;
  const cells: boolean[][] = [];
  let h = 2166136261;
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) {
      h ^= (x * 73856093) ^ (y * 19349663) ^ (seed.charCodeAt((x + y) % seed.length) || 7);
      h = Math.imul(h, 16777619);
      row.push(((h >>> 0) % 5) < 2);
    }
    cells.push(row);
  }
  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 3; y++) {
      const row = cells[oy + y]; if (!row) continue;
      for (let x = 0; x < 3; x++) row[ox + x] = x === 1 && y === 1 ? true : (x === 0 || x === 2 || y === 0 || y === 2);
    }
  };
  finder(0, 0); finder(size - 3, 0); finder(0, size - 3);

  return (
    <div className="shrink-0 rounded-xl border border-slate-100 bg-white p-2 shadow-sm">
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${size}, 6px)` }}>
        {cells.flat().map((on, i) => <span key={i} className={`h-1.5 w-1.5 rounded-[1px] ${on ? "bg-slate-800" : "bg-transparent"}`} />)}
      </div>
    </div>
  );
}

/* ===================== HISTORY VIEW (dengan tombol Detail) ===================== */
function HistoryView({ history, onClear, onViewDetail }: { history: HistoryItem[]; onClear: () => void; onViewDetail: (item: HistoryItem) => void }) {
  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  };
  const formatTime = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  };

  return (
    <div className="max-w-[420px] mx-auto p-4 animate-[fadeUp_.5s_ease]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Riwayat Antrean</h2>
          <p className="text-xs text-slate-500 mt-0.5">Tersimpan di perangkat ini</p>
        </div>
        {history.length > 0 && (
          <button onClick={onClear} className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition">
            <Trash2 className="w-3.5 h-3.5" /> Hapus Semua
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="w-20 h-20 rounded-3xl bg-[#4A7C2F]/10 flex items-center justify-center mx-auto mb-4">
            <History className="w-10 h-10 text-[#4A7C2F]" />
          </div>
          <h3 className="text-lg font-extrabold text-slate-800">Belum ada riwayat</h3>
          <p className="text-sm text-slate-500 mt-2 mb-4">Antrean yang sudah selesai akan otomatis tersimpan di sini.</p>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <AlertCircle className="w-4 h-4" />
            <span>Data hanya tersimpan di HP ini</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {[...history].reverse().map((item, idx) => {
            const svc = SERVICES.find(s => s.value === item.service_type);
            return (
              <div key={item.id || idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                {/* Bagian atas - info utama */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-2xl font-black text-[#4A7C2F] tracking-tight">{item.queue_number}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(item.created_at)} • {formatTime(item.created_at)} WIT</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        item.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                        item.status === "called" ? "bg-blue-100 text-blue-700" :
                        item.status === "skipped" ? "bg-slate-100 text-slate-600" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {item.status === "completed" ? "SELESAI" : item.status === "called" ? "DIPANGGIL" : item.status === "skipped" ? "DILEWAT" : "MENUNGGU"}
                      </span>
                      {item.rated && (
                        <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Dinilai
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-2 border-t border-slate-100">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700 truncate">{item.customer_name}</span>
                  </div>

                  {svc && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <span className={`h-2 w-2 rounded-full ${svc.color}`} />
                      <span className="text-xs font-bold text-slate-600">{svc.label}</span>
                      <span className="text-xs text-slate-400">— {svc.desc}</span>
                    </div>
                  )}
                </div>

                {/* Tombol Detail */}
                <button
                  onClick={() => onViewDetail(item)}
                  className="w-full flex items-center justify-center gap-2 bg-[#4A7C2F]/5 hover:bg-[#4A7C2F]/10 text-[#4A7C2F] font-bold text-xs py-2.5 border-t border-slate-100 transition"
                >
                  <Eye className="w-3.5 h-3.5" /> Lihat Detail
                </button>
              </div>
            );
          })}

          <div className="text-center pt-2">
            <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <Calendar className="w-3 h-3" />
              Menampilkan {history.length} riwayat antrean
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
