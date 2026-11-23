import { z } from "zod";

export const services = ["NPP", "BP", "HR", "BPJS"] as const;

export const serviceLabels: Record<(typeof services)[number], string> = {
  NPP: "Nomor Pensiun (NPP)",
  BP: "Beasiswa (BP)",
  HR: "Kepegawaian (HR)",
  BPJS: "BPJS",
};

export const ticketSchema = z.object({
  customer_name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
  customer_id: z.string().trim().min(4, "Nomor identitas minimal 4 karakter.").max(32),
  service_type: z.enum(services),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000, "Komentar maksimal 1.000 karakter."),
});

export type ServiceType = (typeof services)[number];
export type QueueStatus = "waiting" | "called" | "completed";

export const statusLabels: Record<QueueStatus, string> = {
  waiting: "Menunggu",
  called: "Diproses",
  completed: "Selesai",
};