"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Scissors, Calendar, Users, LayoutDashboard, ChevronLeft, ChevronRight,
  Loader2, X, Check, Plus, Trash2, Pencil, Phone, Camera, Home, Upload,
} from "lucide-react";
import { api, Appointment, Barber, Service, BASE } from "@/lib/api";
import { useLanguage } from "@/lib/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

type Tab = "dashboard" | "appointments" | "barbers" | "services" | "homepage";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
};
const PAYMENT_COLORS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700",
  pending: "bg-yellow-100 text-yellow-700",
};

function toYMD(d: Date) { return d.toISOString().split("T")[0]; }
function initials(name: string) { return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2); }

const OPEN_DAYS = new Set([0, 2, 3, 4, 5]);

export default function AdminPage() {
  const { t } = useLanguage();
  const a = t.admin;
  const [tab, setTab] = useState<Tab>("dashboard");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [filterDate, setFilterDate] = useState<string>(toYMD(today));

  const [barberModal, setBarberModal] = useState<Partial<Barber> | null>(null);
  const [serviceModal, setServiceModal] = useState<Partial<Service> | null>(null);
  const [savingBarber, setSavingBarber] = useState(false);
  const [savingService, setSavingService] = useState(false);

  // Barber photo upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Hero image upload state
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroSuccess, setHeroSuccess] = useState(false);
  const heroInputRef = useRef<HTMLInputElement>(null);

  async function uploadHeroImage() {
    if (!heroFile) return;
    setHeroUploading(true);
    setHeroSuccess(false);
    const form = new FormData();
    form.append("image", heroFile);
    const res = await fetch(`${BASE}/settings/hero-image`, { method: "POST", body: form });
    setHeroUploading(false);
    if (res.ok) { setHeroSuccess(true); setHeroFile(null); }
  }

  function handleHeroSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroFile(file);
    setHeroPreview(URL.createObjectURL(file));
    setHeroSuccess(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [a, b, s] = await Promise.all([api.listAppointments(), api.getBarbers(), api.getServices()]);
    setAppointments(a); setBarbers(b); setServices(s);
    setLoading(false);
  }

  async function cancelAppt(id: number) {
    if (!confirm(a.cancelAppt)) return;
    await api.cancelAppointment(id, { admin: true });
    setAppointments(prev => prev.map(ap => ap.id === id ? { ...ap, status: "cancelled" } : ap));
  }

  async function completeAppt(id: number) {
    await api.updateStatus(id, "completed");
    setAppointments(prev => prev.map(ap => ap.id === id ? { ...ap, status: "completed" } : ap));
  }

  // ── Barber CRUD ───────────────────────────────────────────────────────────
  function openBarberModal(b?: Barber) {
    setBarberModal(b ?? { name: "", specialty: "", phone: "", avatar_color: "#4F46E5" });
    setPhotoFile(null);
    setPhotoPreview(b?.photo_url ? `${BASE}${b.photo_url}` : null);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function saveBarber() {
    if (!barberModal?.name) return;
    setSavingBarber(true);
    try {
      let saved: Barber;
      const payload = {
        name: barberModal.name,
        specialty: barberModal.specialty ?? null,
        phone: barberModal.phone ?? null,
        avatar_color: barberModal.avatar_color ?? "#4F46E5",
      };
      if (barberModal.id) {
        saved = await api.updateBarber(barberModal.id, payload);
        setBarbers(prev => prev.map(b => b.id === saved.id ? saved : b));
      } else {
        saved = await api.createBarber(payload);
        setBarbers(prev => [...prev, saved]);
      }
      // Upload photo if selected
      if (photoFile) {
        const updated = await api.uploadBarberPhoto(saved.id, photoFile);
        setBarbers(prev => prev.map(b => b.id === updated.id ? updated : b));
      }
      setBarberModal(null);
      setPhotoFile(null);
      setPhotoPreview(null);
    } finally {
      setSavingBarber(false);
    }
  }

  async function deleteBarber(id: number) {
    if (!confirm(a.removeBarber)) return;
    await api.deleteBarber(id);
    setBarbers(prev => prev.filter(b => b.id !== id));
  }

  // ── Service CRUD ──────────────────────────────────────────────────────────
  function openServiceModal(s?: Service) {
    if (!s) {
      setServiceModal({ name: "", description: "", price: 0, duration_minutes: 30, category: "haircut" });
      return;
    }
    setServiceModal({ ...s });
  }

  async function saveService() {
    if (!serviceModal?.name || !serviceModal.price || !serviceModal.duration_minutes) return;
    setSavingService(true);
    const payload = {
      name: serviceModal.name,
      description: serviceModal.description ?? null,
      price: Number(serviceModal.price),
      duration_minutes: Number(serviceModal.duration_minutes),
      category: serviceModal.category ?? "haircut",
    };
    try {
      if (serviceModal.id) {
        const updated = await api.updateService(serviceModal.id, payload);
        setServices(prev => prev.map(s => s.id === updated.id ? updated : s));
      } else {
        const created = await api.createService(payload);
        setServices(prev => [...prev, created]);
      }
      setServiceModal(null);
    } finally {
      setSavingService(false);
    }
  }

  async function deleteService(id: number) {
    if (!confirm(a.removeService)) return;
    await api.deleteService(id);
    setServices(prev => prev.filter(s => s.id !== id));
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const todayStr = toYMD(today);
  const todayAppts = appointments.filter(ap => ap.appointment_date === todayStr && ap.status !== "cancelled");
  const upcomingAppts = appointments.filter(ap => ap.appointment_date >= todayStr && ap.status === "confirmed");
  const totalRevenue = appointments.filter(ap => ap.status === "completed").reduce((s, ap) => s + ap.total_price, 0);

  // ── Calendar grid ─────────────────────────────────────────────────────────
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(calYear, calMonth, i + 1)),
  ];
  const filteredAppts = appointments
    .filter(ap => ap.appointment_date === filterDate)
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
  const apptCountByDate: Record<string, number> = {};
  for (const ap of appointments) {
    if (ap.status !== "cancelled") apptCountByDate[ap.appointment_date] = (apptCountByDate[ap.appointment_date] ?? 0) + 1;
  }

  const formatDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString((t.dir as string) === "rtl" ? "he-IL" : "en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="min-h-screen flex bg-[#f8f7f4]">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1a1a1a] text-white flex flex-col py-6 shrink-0">
        <div className="flex items-center gap-2 px-6 mb-8">
          <Scissors className="w-5 h-5 text-amber-400" />
          <span className="font-black text-lg">{a.title}</span>
        </div>
        {([
          { id: "dashboard", icon: <LayoutDashboard className="w-4 h-4" />, label: a.dashboard },
          { id: "appointments", icon: <Calendar className="w-4 h-4" />, label: a.appointments },
          { id: "barbers", icon: <Users className="w-4 h-4" />, label: a.barbers },
          { id: "services", icon: <Scissors className="w-4 h-4" />, label: a.services },
          { id: "homepage", icon: <Home className="w-4 h-4" />, label: a.homePage },
        ] as const).map(item => (
          <button key={item.id} onClick={() => setTab(item.id)}
            className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all ${
              tab === item.id ? "bg-white/10 text-amber-400" : "text-gray-400 hover:text-white"
            }`}>
            {item.icon} {item.label}
          </button>
        ))}
        <div className="mt-auto px-6 flex flex-col gap-2">
          <LanguageToggle />
          <Link href="/" className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition">
            <ChevronLeft className="w-4 h-4" /> {t.nav.backToSite}
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto">
        {loading && <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>}

        {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
        {!loading && tab === "dashboard" && (
          <div>
            <h1 className="text-2xl font-black mb-6">{a.dashboard}</h1>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
              <StatCard title={a.todayAppts} value={todayAppts.length} sub={todayStr} color="bg-blue-50" />
              <StatCard title={a.upcoming} value={upcomingAppts.length} sub={a.fromToday} color="bg-amber-50" />
              <StatCard title={a.revenue} value={`₪${totalRevenue.toFixed(0)}`} sub={a.allTime} color="bg-green-50" />
            </div>
            <h2 className="font-bold text-lg mb-3">{a.todaySchedule}</h2>
            {todayAppts.length === 0 ? <p className="text-gray-400 text-sm">{a.noApptToday}</p> : (
              <div className="space-y-3">
                {todayAppts.sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
                  .map(ap => <ApptRow key={ap.id} appt={ap} onCancel={cancelAppt} onComplete={completeAppt} t={t} />)}
              </div>
            )}
          </div>
        )}

        {/* ── APPOINTMENTS ──────────────────────────────────────────────── */}
        {!loading && tab === "appointments" && (
          <div>
            <h1 className="text-2xl font-black mb-6">{a.appointments}</h1>
            <div className="flex gap-6 flex-wrap">
              {/* Calendar picker */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 w-72 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => { if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11); } else setCalMonth(m => m-1); }}>
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="font-bold text-sm">{t.calendar.months[calMonth]} {calYear}</span>
                  <button onClick={() => { if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0); } else setCalMonth(m => m+1); }}>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {t.calendar.days.map((d, i) => (
                    <div key={i} className={`text-center text-xs py-1 font-semibold ${i === 1 || i === 6 ? "text-gray-300" : "text-gray-400"}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1">
                  {calCells.map((date, idx) => {
                    if (!date) return <div key={idx} />;
                    const ymd = toYMD(date);
                    const isSelected = ymd === filterDate;
                    const isOpenDay = OPEN_DAYS.has(date.getDay());
                    const count = apptCountByDate[ymd] ?? 0;
                    return (
                      <button key={idx} onClick={() => setFilterDate(ymd)} disabled={!isOpenDay}
                        className={`w-full aspect-square rounded-full text-xs font-medium relative transition-all ${
                          isSelected ? "bg-[#1a1a1a] text-white" : isOpenDay ? "hover:bg-gray-100" : "text-gray-300 cursor-not-allowed"
                        }`}>
                        {date.getDate()}
                        {count > 0 && !isSelected && <span className="absolute bottom-0 end-0 w-2 h-2 bg-amber-400 rounded-full" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Appointment list */}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold mb-3 text-gray-700">
                  {filterDate === todayStr ? t.calendar.today : formatDate(filterDate)} — {filteredAppts.length}
                </h2>
                {filteredAppts.length === 0 ? <p className="text-gray-400 text-sm">{a.noApptDay}</p> : (
                  <div className="space-y-3">
                    {filteredAppts.map(ap => <ApptRow key={ap.id} appt={ap} onCancel={cancelAppt} onComplete={completeAppt} t={t} />)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BARBERS ───────────────────────────────────────────────────── */}
        {!loading && tab === "barbers" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-black">{a.barbers}</h1>
              <button onClick={() => openBarberModal()}
                className="flex items-center gap-2 bg-[#1a1a1a] text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-800 transition">
                <Plus className="w-4 h-4" /> {a.addBarber}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {barbers.map(b => (
                <div key={b.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-4">
                  {b.photo_url ? (
                    <img src={`${BASE}${b.photo_url}`} alt={b.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0"
                      style={{ backgroundColor: b.avatar_color }}>{initials(b.name)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold">{b.name}</h3>
                    {b.specialty && <p className="text-xs text-gray-500 mt-0.5">{b.specialty}</p>}
                    {b.phone && <div className="flex items-center gap-1 text-xs text-gray-400 mt-1"><Phone className="w-3 h-3" /> {b.phone}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openBarberModal(b)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteBarber(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SERVICES ──────────────────────────────────────────────────── */}
        {!loading && tab === "services" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-black">{a.services}</h1>
              <button onClick={() => openServiceModal()}
                className="flex items-center gap-2 bg-[#1a1a1a] text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-800 transition">
                <Plus className="w-4 h-4" /> {a.addService}
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{[a.colService, a.colCategory, a.colDuration, a.colPrice, ""].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {services.map(s => (
                    <tr key={s.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-5 py-4"><div className="font-medium">{t.services.names[s.name] ?? s.name}</div>
                        {s.description && <div className="text-xs text-gray-400 mt-0.5">{t.services.descriptions[s.description] ?? s.description}</div>}</td>
                      <td className="px-5 py-4 capitalize text-gray-600">{t.services.categories[s.category as keyof typeof t.services.categories] ?? s.category}</td>
                      <td className="px-5 py-4 text-gray-600">{s.duration_minutes} {t.services.approxMin}</td>
                      <td className="px-5 py-4 font-bold">₪{s.price}</td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => openServiceModal(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => deleteService(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* ── HOME PAGE ─────────────────────────────────────────────────── */}
        {!loading && tab === "homepage" && (
          <div>
            <h1 className="text-2xl font-black mb-2">{a.editHomePage}</h1>
            <p className="text-gray-500 text-sm mb-8">{a.homePageSub}</p>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-xl">
              <h2 className="font-bold mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-500" />
                {a.heroBgImage}
              </h2>

              {/* Current / preview image */}
              <div className="rounded-xl overflow-hidden border border-gray-200 mb-5 aspect-video bg-gray-100 relative">
                {heroPreview ? (
                  <img src={heroPreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                    <Camera className="w-8 h-8" />
                    <span className="text-sm">{a.noImageYet}</span>
                  </div>
                )}
              </div>

              {/* Upload controls */}
              <input
                ref={heroInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleHeroSelect}
                className="hidden"
              />

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => heroInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-4 text-sm font-medium text-gray-600 hover:border-amber-400 hover:text-amber-600 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  {heroFile ? heroFile.name : a.chooseImage}
                </button>

                {heroFile && (
                  <button
                    onClick={uploadHeroImage}
                    disabled={heroUploading}
                    className="flex items-center justify-center gap-2 bg-[#1a1a1a] text-white py-3 rounded-full font-bold hover:bg-gray-800 transition disabled:opacity-50"
                  >
                    {heroUploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> {a.uploading}</>
                    ) : (
                      <><Upload className="w-4 h-4" /> {a.uploadApply}</>
                    )}
                  </button>
                )}

                {heroSuccess && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                    <Check className="w-4 h-4 shrink-0" />
                    {a.imageUpdated}
                  </div>
                )}

                <p className="text-xs text-gray-400">{a.imageFormats}</p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── BARBER MODAL ──────────────────────────────────────────────────── */}
      {barberModal && (
        <Modal title={barberModal.id ? a.editBarber : a.addBarber} onClose={() => { setBarberModal(null); setPhotoFile(null); setPhotoPreview(null); }}>
          <div className="space-y-4">
            {/* Photo upload */}
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-2">{a.photo}</label>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: !photoPreview ? (barberModal.avatar_color ?? "#4F46E5") : undefined }}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-black text-lg">{barberModal.name ? initials(barberModal.name) : "?"}</span>
                  )}
                </div>
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-50 transition">
                  <Camera className="w-4 h-4" /> {photoPreview ? a.changePhoto : a.uploadPhoto}
                </button>
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelect} className="hidden" />
              </div>
            </div>

            <MField label={a.name}>
              <input className="input" value={barberModal.name ?? ""} onChange={e => setBarberModal(p => ({ ...p, name: e.target.value }))} placeholder={a.namePlaceholder} />
            </MField>
            <MField label={a.specialty}>
              <input className="input" value={barberModal.specialty ?? ""} onChange={e => setBarberModal(p => ({ ...p, specialty: e.target.value }))} placeholder={a.specialtyPlaceholder} />
            </MField>
            <MField label={a.phone}>
              <input className="input" value={barberModal.phone ?? ""} onChange={e => setBarberModal(p => ({ ...p, phone: e.target.value }))} placeholder="05X-XXXXXXX" />
            </MField>
            <MField label={a.avatarColor}>
              <input type="color" value={barberModal.avatar_color ?? "#4F46E5"}
                onChange={e => setBarberModal(p => ({ ...p, avatar_color: e.target.value }))}
                className="h-10 w-full rounded-xl border border-gray-200 cursor-pointer" />
            </MField>
            <button onClick={saveBarber} disabled={savingBarber || !barberModal.name}
              className="w-full bg-[#1a1a1a] text-white py-3 rounded-full font-bold hover:bg-gray-800 transition disabled:opacity-40">
              {savingBarber ? a.saving : a.save}
            </button>
          </div>
        </Modal>
      )}

      {/* ── SERVICE MODAL ─────────────────────────────────────────────────── */}
      {serviceModal && (
        <Modal title={serviceModal.id ? a.editService : a.addService} onClose={() => setServiceModal(null)}>
          <div className="space-y-4">
            <MField label={a.serviceName}>
              <input className="input" value={serviceModal.name ?? ""} onChange={e => setServiceModal(p => ({ ...p, name: e.target.value }))} />
            </MField>
            <MField label={a.description}>
              <input className="input" value={serviceModal.description ?? ""} onChange={e => setServiceModal(p => ({ ...p, description: e.target.value }))} />
            </MField>
            <div className="grid grid-cols-2 gap-3">
              <MField label={a.price}>
                <input type="number" className="input" value={serviceModal.price ?? ""} onChange={e => setServiceModal(p => ({ ...p, price: Number(e.target.value) }))} />
              </MField>
              <MField label={a.durationMin}>
                <input type="number" className="input" value={serviceModal.duration_minutes ?? ""} onChange={e => setServiceModal(p => ({ ...p, duration_minutes: Number(e.target.value) }))} />
              </MField>
            </div>
            <MField label={a.category}>
              <select className="input" value={serviceModal.category ?? "haircut"} onChange={e => setServiceModal(p => ({ ...p, category: e.target.value }))}>
                <option value="haircut">{a.catHaircut}</option>
                <option value="beard">{a.catBeard}</option>
                <option value="combo">{a.catCombo}</option>
                <option value="accessories">{a.catAccessories}</option>
              </select>
            </MField>
            <button onClick={saveService} disabled={savingService || !serviceModal.name || !serviceModal.price}
              className="w-full bg-[#1a1a1a] text-white py-3 rounded-full font-bold hover:bg-gray-800 transition disabled:opacity-40">
              {savingService ? a.saving : a.save}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, color }: { title: string; value: string | number; sub: string; color: string }) {
  return (
    <div className={`${color} rounded-2xl p-5`}>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{title}</div>
      <div className="text-3xl font-black text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

function ApptRow({ appt, onCancel, onComplete, t }: {
  appt: Appointment;
  onCancel: (id: number) => void;
  onComplete: (id: number) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start gap-4">
      <div className="text-center bg-gray-50 rounded-xl px-3 py-2 shrink-0">
        <div className="text-lg font-black text-gray-900">{appt.appointment_time}</div>
        <div className="text-xs text-gray-400">{appt.end_time}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-bold">{appt.customer_name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[appt.status] ?? "bg-gray-100 text-gray-600"}`}>
            {t.status[appt.status as keyof typeof t.status] ?? appt.status}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[appt.payment_status] ?? "bg-gray-100 text-gray-600"}`}>
            {t.status[appt.payment_status as keyof typeof t.status] ?? appt.payment_status}
          </span>
        </div>
        <div className="text-sm text-gray-600">{appt.services.map(s => t.services.names[s.name] ?? s.name).join(" + ")} · {appt.barber.name}</div>
        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
          <Phone className="w-3 h-3" /> {appt.customer_phone} · ₪{appt.total_price}
        </div>
      </div>
      {appt.status === "confirmed" && (
        <div className="flex gap-2 shrink-0">
          <button onClick={() => onComplete(appt.id)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Complete">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => onCancel(appt.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Cancel">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-black text-lg">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
