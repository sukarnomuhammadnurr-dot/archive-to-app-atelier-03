import { useState } from "react";
import { Star, Send } from "lucide-react";
import { supabase } from "../../integrations/supabase/client";

export default function FeedbackForm({ queueId, onSuccess }: { queueId: string; onSuccess: (rating: number, comment: string) => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!rating) { setError("Pilih rating bintang dulu!"); return; }
    setError("");
    setLoading(true);
    const { error } = await supabase.from("feedbacks").insert({ queue_id: queueId, rating, comment });
    setLoading(false);
    if (error) setError("Gagal mengirim penilaian. Coba lagi.");
    else onSuccess(rating, comment); // 🔑 Kirim rating & comment ke parent
  };

  return (
    <div className="animate-[fadeUp_.5s_ease] p-6 bg-white rounded-[28px] shadow-[0_24px_70px_-24px_rgba(30,41,59,.3)] border border-[#4A7C2F]/10">
      <h3 className="text-lg font-bold text-slate-800 text-center">Bagaimana pelayanan kami?</h3>
      <p className="text-sm text-slate-500 text-center mt-1 mb-5">Beri rating untuk membantu kami meningkatkan layanan.</p>

      {/* Bintang */}
      <div className="flex justify-center gap-2 mb-5">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = (hover || rating) >= star;
          return (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onClick={() => { setRating(star); setError(""); }}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <Star className={`w-9 h-9 ${active ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
            </button>
          );
        })}
      </div>

      {/* Komentar */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Tulis komentar (opsional)..."
        className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-[#4A7C2F]/20 focus:border-[#4A7C2F] outline-none mb-4 resize-none"
        rows={3}
      />

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-3 text-center">{error}</p>}

      <button
        onClick={submit}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-[#4A7C2F] hover:bg-[#3d6826] text-white font-bold py-3.5 rounded-2xl transition active:scale-[.98] disabled:opacity-60 shadow-lg shadow-[#4A7C2F]/30"
      >
        <Send className="w-4 h-4" /> {loading ? "Mengirim..." : "Kirim Penilaian"}
      </button>
    </div>
  );
}
