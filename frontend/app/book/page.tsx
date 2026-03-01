"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Scissors, ChevronLeft, ChevronRight, Check, Loader2, AlertCircle } from "lucide-react";
import { api, Service, Barber, TimeSlot, Appointment } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import StepIndicator from "@/components/StepIndicator";
import ServiceCard from "@/components/ServiceCard";
import BarberCard from "@/components/BarberCard";
import MiniCalendar from "@/components/MiniCalendar";

type PaymentMethod = "prepay" | "on_site";

export default function BookPage() {
  const { t } = useLanguage();
  const steps = t.booking.steps.map((label) => ({ label }));

  const [step, setStep] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("on_site");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    api.getServices().then(setServices).catch(console.error);
    api.getBarbers().then(setBarbers).catch(console.error);
  }, []);

  const fetchSlots = useCallback(async () => {
    if (!selectedBarber || !selectedDate) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAvailability(selectedBarber, selectedDate, selectedServices);
      setSlots(data.slots);
    } catch {
      setError("Could not load availability. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }, [selectedBarber, selectedDate, selectedServices]);

  useEffect(() => {
    if (step === 3) fetchSlots();
  }, [step, fetchSlots]);

  function toggleService(id: number) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    setSelectedTime(null);
  }

  const selectedServiceObjs = services.filter((s) => selectedServices.includes(s.id));
  const selectedBarberObj = barbers.find((b) => b.id === selectedBarber);
  const totalPrice = selectedServiceObjs.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServiceObjs.reduce((sum, s) => sum + s.duration_minutes, 0);

  function svcName(name: string) {
    return t.services.names[name] ?? name;
  }

  async function submitBooking() {
    if (!selectedBarber || !selectedDate || !selectedTime || !name || !phone) return;
    setLoading(true);
    setError(null);
    try {
      const appt = await api.createAppointment({
        customer_name: name,
        customer_phone: phone,
        customer_email: email || undefined,
        barber_id: selectedBarber,
        service_ids: selectedServices,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        payment_method: paymentMethod,
        notes: notes || undefined,
      });
      setConfirmedAppointment(appt);
      setStep(6);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function canProceed(): boolean {
    if (step === 0) return selectedServices.length > 0;
    if (step === 1) return selectedBarber !== null;
    if (step === 2) return selectedDate !== null;
    if (step === 3) return selectedTime !== null;
    if (step === 4) return name.trim().length > 0 && phone.trim().length > 0;
    return true;
  }

  function formatDate(d: string) {
    return new Date(d + "T12:00:00").toLocaleDateString((t.dir as string) === "rtl" ? "he-IL" : "en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }

  // ── Confirmation ──────────────────────────────────────────────────────────
  if (step === 6 && confirmedAppointment) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-black mb-2">{t.booking.confirmed}</h1>
          <p className="text-gray-500 mb-6">{t.booking.confirmedSub}</p>

          <div className="bg-gray-50 rounded-2xl p-5 text-left space-y-3 mb-6">
            <Row label={t.booking.apptNum} value={`#${confirmedAppointment.id}`} />
            <Row label={t.booking.labelCustomer} value={confirmedAppointment.customer_name} />
            <Row label={t.booking.labelBarber} value={confirmedAppointment.barber.name} />
            <Row label={t.booking.labelServices} value={confirmedAppointment.services.map((s) => svcName(s.name)).join(", ")} />
            <Row label={t.booking.labelDate} value={formatDate(confirmedAppointment.appointment_date)} />
            <Row label={t.booking.labelTime} value={`${confirmedAppointment.appointment_time} – ${confirmedAppointment.end_time}`} />
            <Row label={t.booking.labelTotal} value={`₪${confirmedAppointment.total_price.toFixed(2)}`} bold />
            <Row label={t.booking.labelPayment} value={
              confirmedAppointment.payment_method === "prepay" ? t.booking.paidOnline : t.booking.payAtShopLabel
            } />
          </div>

          <Link href="/" className="block w-full bg-[#1a1a1a] text-white py-3 rounded-full font-bold hover:bg-gray-800 transition mb-3">
            {t.booking.backHome}
          </Link>
          <Link href={`/manage?id=${confirmedAppointment.id}&phone=${encodeURIComponent(confirmedAppointment.customer_phone)}`}
            className="block w-full border border-gray-300 text-gray-700 py-3 rounded-full font-medium hover:bg-gray-50 transition text-sm mb-3">
            {t.nav.manageAppt}
          </Link>
          <button
            onClick={() => {
              setStep(0); setSelectedServices([]); setSelectedBarber(null);
              setSelectedDate(null); setSelectedTime(null);
              setName(""); setPhone(""); setEmail(""); setNotes("");
              setConfirmedAppointment(null);
            }}
            className="text-sm text-gray-500 hover:text-gray-800 transition"
          >
            {t.booking.bookAnother}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      <header className="bg-[#1a1a1a] text-white px-6 py-4 flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-white transition">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <Scissors className="w-5 h-5 text-amber-400" />
        <span className="font-bold flex-1">{t.booking.pageTitle}</span>
        <LanguageToggle />
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <StepIndicator steps={steps} current={step} />

        {error && (
          <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Step 0: Services */}
        {step === 0 && (
          <StepShell title={t.booking.selectServices} subtitle={t.booking.chooseServices}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.map((s) => (
                <ServiceCard key={s.id} service={s} selected={selectedServices.includes(s.id)} onToggle={() => toggleService(s.id)} />
              ))}
            </div>
            {selectedServices.length > 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 font-medium">
                {selectedServiceObjs.map(s => svcName(s.name)).join(" + ")} — ₪{totalPrice} · ~{totalDuration} {t.booking.approxMin}
              </div>
            )}
          </StepShell>
        )}

        {/* Step 1: Barber */}
        {step === 1 && (
          <StepShell title={t.booking.chooseBarber} subtitle={t.booking.pickBarber}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {barbers.map((b) => (
                <BarberCard key={b.id} barber={b} selected={selectedBarber === b.id} onSelect={() => setSelectedBarber(b.id)} />
              ))}
            </div>
          </StepShell>
        )}

        {/* Step 2: Date */}
        {step === 2 && (
          <StepShell title={t.booking.pickDate} subtitle={t.booking.openDays}>
            <MiniCalendar
              selected={selectedDate}
              onSelect={(d) => { setSelectedDate(d); setSelectedTime(null); }}
              cal={t.calendar}
            />
            {selectedDate && (
              <p className="mt-4 text-center text-sm font-medium text-green-700 bg-green-50 rounded-xl py-2">
                {t.booking.selectedDate} {formatDate(selectedDate)}
              </p>
            )}
          </StepShell>
        )}

        {/* Step 3: Time */}
        {step === 3 && (
          <StepShell title={t.booking.selectTime} subtitle={`${t.booking.availableOn} ${selectedDate ? formatDate(selectedDate) : ""}`}>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : slots.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t.booking.noSlots}</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.time)}
                    className={`rounded-xl py-3 text-sm font-semibold transition-all border-2 ${
                      selectedTime === slot.time
                        ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                        : slot.available
                        ? "bg-white border-gray-200 hover:border-gray-400 text-gray-800"
                        : "bg-gray-100 border-gray-100 text-gray-300 cursor-not-allowed line-through"
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </StepShell>
        )}

        {/* Step 4: Details */}
        {step === 4 && (
          <StepShell title={t.booking.yourDetails} subtitle={t.booking.detailsSub}>
            <div className="space-y-4">
              <Field label={t.booking.fullName}>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]" />
              </Field>
              <Field label={t.booking.phone}>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="05X-XXXXXXX" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]" />
              </Field>
              <Field label={t.booking.email}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]" />
              </Field>
              <Field label={t.booking.notes}>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.booking.notesPlaceholder} rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]" />
              </Field>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t.booking.paymentMethod}</label>
                <div className="grid grid-cols-2 gap-3">
                  <PayBtn active={paymentMethod === "on_site"} onClick={() => setPaymentMethod("on_site")}
                    title={t.booking.payAtShop} desc={t.booking.payAtShopDesc} />
                  <PayBtn active={paymentMethod === "prepay"} onClick={() => setPaymentMethod("prepay")}
                    title={t.booking.payOnline} desc={t.booking.payOnlineDesc} />
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <StepShell title={t.booking.reviewTitle} subtitle={t.booking.reviewSub}>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 mb-4">
              <Row label={t.booking.labelServices} value={selectedServiceObjs.map(s => svcName(s.name)).join(", ")} />
              <Row label={t.booking.labelBarber} value={selectedBarberObj?.name ?? ""} />
              <Row label={t.booking.labelDate} value={selectedDate ? formatDate(selectedDate) : ""} />
              <Row label={t.booking.labelTime} value={selectedTime ?? ""} />
              <Row label={t.booking.labelDuration} value={`~${totalDuration} ${t.booking.approxMin}`} />
              <div className="border-t border-gray-100 pt-3">
                <Row label={t.booking.labelTotal} value={`₪${totalPrice.toFixed(2)}`} bold />
                <Row label={t.booking.labelPayment} value={paymentMethod === "prepay" ? t.booking.payNowLabel : t.booking.payAtShopLabel} />
              </div>
              <div className="border-t border-gray-100 pt-3">
                <Row label={t.booking.labelName} value={name} />
                <Row label={t.booking.labelPhone} value={phone} />
                {email && <Row label={t.booking.labelEmail} value={email} />}
                {notes && <Row label={t.booking.labelNotes} value={notes} />}
              </div>
            </div>
            {paymentMethod === "prepay" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 mb-4">
                {t.booking.onlinePayNote}
              </div>
            )}
            <button onClick={submitBooking} disabled={loading}
              className="w-full bg-[#1a1a1a] text-white py-4 rounded-full font-bold text-lg hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? (<><Loader2 className="w-5 h-5 animate-spin" /> {t.booking.bookingBtn}</>) : (<>{t.booking.confirmBtn} <Check className="w-5 h-5" /></>)}
            </button>
          </StepShell>
        )}

        {/* Navigation */}
        {step < 6 && (
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1 px-5 py-3 rounded-full border border-gray-300 font-medium hover:bg-gray-100 transition">
                <ChevronLeft className="w-4 h-4" /> {t.booking.back}
              </button>
            )}
            {step < 5 && (
              <button disabled={!canProceed()} onClick={() => setStep((s) => s + 1)}
                className="flex-1 flex items-center justify-center gap-1 bg-[#1a1a1a] text-white py-3 rounded-full font-bold hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed">
                {t.booking.continue} <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl font-black mb-1">{title}</h2>
      <p className="text-gray-500 text-sm mb-6">{subtitle}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? "font-black text-base text-gray-900" : "font-medium text-gray-900 text-end max-w-[60%]"}>{value}</span>
    </div>
  );
}

function PayBtn({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition-all ${active ? "border-[#1a1a1a] bg-[#1a1a1a] text-white" : "border-gray-200 bg-white hover:border-gray-400"}`}>
      <div className="font-bold text-sm">{title}</div>
      <div className={`text-xs mt-0.5 ${active ? "text-gray-300" : "text-gray-500"}`}>{desc}</div>
    </button>
  );
}
