const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export { BASE };

export interface Service {
  id: number;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  category: string;
  is_active: boolean;
}

export interface Barber {
  id: number;
  name: string;
  specialty: string | null;
  phone: string | null;
  avatar_color: string;
  photo_url: string | null;
  is_active: boolean;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface AvailabilityOut {
  date: string;
  barber_id: number;
  slots: TimeSlot[];
}

export interface Appointment {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  barber: Barber;
  services: Service[];
  appointment_date: string;
  appointment_time: string;
  end_time: string;
  total_price: number;
  payment_method: string;
  payment_status: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface CreateAppointmentPayload {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  barber_id: number;
  service_ids: number[];
  appointment_date: string;
  appointment_time: string;
  payment_method: "prepay" | "on_site";
  notes?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

export const api = {
  getServices: () => request<Service[]>("/services"),
  getBarbers: () => request<Barber[]>("/barbers"),

  getAvailability: (barberId: number, date: string, serviceIds?: number[], excludeApptId?: number) => {
    const params = new URLSearchParams();
    if (serviceIds?.length) params.set("service_ids", serviceIds.join(","));
    if (excludeApptId) params.set("exclude_appointment_id", String(excludeApptId));
    const q = params.toString() ? `?${params}` : "";
    return request<AvailabilityOut>(`/availability/${barberId}/${date}${q}`);
  },

  createAppointment: (data: CreateAppointmentPayload) =>
    request<Appointment>("/appointments", { method: "POST", body: JSON.stringify(data) }),

  listAppointments: (params?: { date?: string; barber_id?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.date) q.set("date", params.date);
    if (params?.barber_id) q.set("barber_id", String(params.barber_id));
    if (params?.status) q.set("status", params.status);
    return request<Appointment[]>(`/appointments?${q}`);
  },

  getAppointment: (id: number, phone?: string) => {
    const q = phone ? `?phone=${encodeURIComponent(phone)}` : "";
    return request<Appointment>(`/appointments/${id}${q}`);
  },

  cancelAppointment: (id: number, options?: { phone?: string; admin?: boolean }) => {
    const q = new URLSearchParams();
    if (options?.phone) q.set("phone", options.phone);
    if (options?.admin) q.set("admin", "true");
    return request<{ ok: boolean }>(`/appointments/${id}?${q}`, { method: "DELETE" });
  },

  rescheduleAppointment: (id: number, phone: string, newDate: string, newTime: string) =>
    request<Appointment>(`/appointments/${id}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify({ phone, new_date: newDate, new_time: newTime }),
    }),

  updateStatus: (id: number, status: string) =>
    request<Appointment>(`/appointments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // Barber CRUD
  createBarber: (data: Omit<Barber, "id" | "is_active" | "photo_url">) =>
    request<Barber>("/barbers", { method: "POST", body: JSON.stringify(data) }),
  updateBarber: (id: number, data: Omit<Barber, "id" | "is_active" | "photo_url">) =>
    request<Barber>(`/barbers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteBarber: (id: number) =>
    request<{ ok: boolean }>(`/barbers/${id}`, { method: "DELETE" }),

  uploadBarberPhoto: async (barberId: number, file: File): Promise<Barber> => {
    const form = new FormData();
    form.append("photo", file);
    const res = await fetch(`${BASE}/barbers/${barberId}/photo`, { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "Upload failed");
    }
    return res.json();
  },

  // Service CRUD
  createService: (data: Omit<Service, "id" | "is_active">) =>
    request<Service>("/services", { method: "POST", body: JSON.stringify(data) }),
  updateService: (id: number, data: Omit<Service, "id" | "is_active">) =>
    request<Service>(`/services/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteService: (id: number) =>
    request<{ ok: boolean }>(`/services/${id}`, { method: "DELETE" }),
};
