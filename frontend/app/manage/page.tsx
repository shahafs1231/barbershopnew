"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Scissors, ChevronLeft, Loader2, AlertCircle, Check, Clock, Calendar, X } from "lucide-react";
import { api, Appointment } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import MiniCalendar from "@/components/MiniCalendar";

const CANCEL_CUTOFF = 8; // hours

function hoursUntil(appt: Appointment): number {
  const apptDt = new Date(`${appt.appointment_date}T${appt.appointment_time}:00`);
  return (apptDt.getTime() - Date.now()) / 3_600_000;
}

function ManageContent() {
  const { t } = useLanguage();
  const m = t.manage;
  const searchParams = useSearchParams();

  const [apptId, setApptId] = useState(searchParams.get("id") ?? "");
  const [phone, setPhone] = useState(searchParams.get("phone") ?? "");
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Reschedule modal
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState<string | null>(null);
  const [newTime, setNewTime] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Auto-search if params given
  useEffect(() => {
    if (searchParams.get("id") && searchParams.get("phone")) {
      handleFind();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFind() {
    if (!apptId || !phone) return;
    setLoading(true);
    setError(null);
    setAppt(null);
    setSuccess(null);
    try {
      const found = await api.getAppointment(Number(apptId), phone);
      setAppt(found);
    } catch {
      setError(m.notFound);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!appt) return;
    setCancelling(true);
    setError(null);
    try {
      await api.cancelAppointment(appt.id, { phone });
      setAppt({ ...appt, status: "cancelled" });
      setShowCancel(false);
      setSuccess(m.cancelSuccess);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCancelling(false);
    }
  }

  // Load reschedule slots when date changes
  useEffect(() => {
    if (!showReschedule || !newDate || !appt) return;
    setLoadingSlots(true);
    setNewTime(null);
    const serviceIds = appt.services.map((s) => s.id);
    api.getAvailability(appt.barber.id, newDate, serviceIds, appt.id)
      .then((d) => setSlots(d.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [newDate, showReschedule, appt]);

  async function handleReschedule() {
    if (!appt || !newDate || !newTime) return;
    setRescheduling(true);
    setError(null);
    try {
      const updated = await api.rescheduleAppointment(appt.id, phone, newDate, newTime);
      setAppt(updated);
      setShowReschedule(false);
      setNewDate(null);
      setNewTime(null);
      setSuccess(m.rescheduleSuccess);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setRescheduling(false);
    }
  }

  function formatDate(d: string) {
    return new Date(d + "T12:00:00").toLocaleDateString((t.dir as string) === "rtl" ? "he-IL" : "en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }

  const hours = appt ? hoursUntil(appt) : 0;
  const canModify = appt?.status === "confirmed" && hours >= CANCEL_CUTOFF;

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      <header className="bg-[#1a1a1a] text-white px-6 py-4 flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-white transition">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <Scissors className="w-5 h-5 text-amber-400" />
        <span className="font-bold flex-1">{m.pageTitle}</span>
        <LanguageToggle />
      </header>

      <div className="max-w-lg mx-auto px-4 py-10">
        {/* Search form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="font-black text-lg mb-1">{m.pageTitle}</h2>
          <p className="text-sm text-gray-500 mb-5">{m.sub}</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">{m.apptId}</label>
              <input
                type="number"
                value={apptId}
                onChange={(e) => setApptId(e.target.value)}
                placeholder="e.g. 3"
                className="input w-full"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">{m.phone}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05X-XXXXXXX"
                className="input w-full"
              />
            </div>
            <button
              onClick={handleFind}
              disabled={loading || !apptId || !phone}
              className="w-full bg-[#1a1a1a] text-white py-3 rounded-full font-bold hover:bg-gray-800 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {m.findingBtn}</> : m.findBtn}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-5 h-5 shrink-0" /> <span className="text-sm">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 mb-4">
            <Check className="w-5 h-5 shrink-0" /> <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Appointment card */}
        {appt && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Status banner */}
            <div className={`px-5 py-3 flex items-center justify-between ${
              appt.status === "confirmed" ? "bg-green-50 border-b border-green-100" :
              appt.status === "cancelled" ? "bg-red-50 border-b border-red-100" :
              "bg-blue-50 border-b border-blue-100"
            }`}>
              <span className="font-bold text-sm">#{appt.id}</span>
              <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${
                appt.status === "confirmed" ? "bg-green-100 text-green-700" :
                appt.status === "cancelled" ? "bg-red-100 text-red-700" :
                "bg-blue-100 text-blue-700"
              }`}>
                {appt.status === "confirmed" ? t.status.confirmed : appt.status === "cancelled" ? m.cancelledBadge : m.completedBadge}
              </span>
            </div>

            <div className="p-5 space-y-3">
              <InfoRow icon={<Calendar className="w-4 h-4" />} label={formatDate(appt.appointment_date)} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label={`${appt.appointment_time} – ${appt.end_time}`} />
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <Detail label={t.booking.labelBarber} value={appt.barber.name} />
                <Detail label={t.booking.labelServices} value={appt.services.map(s => t.services.names[s.name] ?? s.name).join(", ")} />
                <Detail label={t.booking.labelTotal} value={`₪${appt.total_price.toFixed(2)}`} bold />
                <Detail label={t.booking.labelPayment} value={
                  appt.payment_method === "prepay" ? t.booking.paidOnline : t.booking.payAtShopLabel
                } />
              </div>
            </div>

            {/* Action area */}
            {appt.status === "confirmed" && (
              <div className="px-5 pb-5">
                {canModify ? (
                  <>
                    <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {m.hoursLeft(hours)} · {m.cutoffNote}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => { setShowReschedule(true); setError(null); setSuccess(null); }}
                        className="flex items-center justify-center gap-2 bg-[#1a1a1a] text-white py-3 rounded-full text-sm font-bold hover:bg-gray-800 transition"
                      >
                        <Calendar className="w-4 h-4" /> {m.rescheduleBtn}
                      </button>
                      <button
                        onClick={() => { setShowCancel(true); setError(null); setSuccess(null); }}
                        className="flex items-center justify-center gap-2 border-2 border-red-200 text-red-600 py-3 rounded-full text-sm font-bold hover:bg-red-50 transition"
                      >
                        <X className="w-4 h-4" /> {m.cancelBtn}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700">
                    <p className="font-bold">{m.cancelDeadline}</p>
                    <p className="text-xs mt-0.5">{m.cancelDeadlineSub(Math.max(0, hours))}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cancel modal */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-black text-lg mb-2">{m.cancelTitle}</h3>
            <p className="text-gray-600 text-sm mb-1">{m.cancelConfirm}</p>
            <p className="text-red-500 text-xs mb-5">{m.cancelWarning}</p>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setShowCancel(false)}
                className="flex-1 border border-gray-300 py-3 rounded-full text-sm font-medium hover:bg-gray-50 transition">
                {t.booking.back}
              </button>
              <button onClick={handleCancel} disabled={cancelling}
                className="flex-1 bg-red-600 text-white py-3 rounded-full text-sm font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {m.confirmCancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule modal */}
      {showReschedule && appt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-lg">{m.rescheduleTitle}</h3>
              <button onClick={() => setShowReschedule(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-semibold text-gray-600 mb-2">{m.newDate}</p>
            <MiniCalendar selected={newDate} onSelect={(d) => { setNewDate(d); setNewTime(null); }} cal={t.calendar} />

            {newDate && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-600 mb-2">{m.newTime}</p>
                {loadingSlots ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((s) => (
                      <button key={s.time} disabled={!s.available} onClick={() => setNewTime(s.time)}
                        className={`rounded-xl py-2 text-sm font-semibold transition-all border-2 ${
                          newTime === s.time ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                          : s.available ? "bg-white border-gray-200 hover:border-gray-400"
                          : "bg-gray-100 border-gray-100 text-gray-300 cursor-not-allowed line-through"
                        }`}>
                        {s.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

            <button onClick={handleReschedule} disabled={rescheduling || !newDate || !newTime}
              className="mt-5 w-full bg-[#1a1a1a] text-white py-3 rounded-full font-bold hover:bg-gray-800 transition disabled:opacity-40 flex items-center justify-center gap-2">
              {rescheduling ? <><Loader2 className="w-4 h-4 animate-spin" /> {m.rescheduling}</> : m.confirmReschedule}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManagePage() {
  return (
    <Suspense>
      <ManageContent />
    </Suspense>
  );
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-700 font-medium text-sm">
      <span className="text-amber-500">{icon}</span> {label}
    </div>
  );
}

function Detail({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? "font-black text-gray-900" : "font-medium text-gray-900"}>{value}</span>
    </div>
  );
}
