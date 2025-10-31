// lib/firebase/types.ts (FULL PATCHED)

import { Timestamp } from "firebase/firestore";

// Tipe Data untuk Trip Package (Baru Ditambahkan)
export interface TripPackage {
    id: string;
    packageName: string;
    description: string;
    duration: string;
    price: number;
    destination: string;
    imageUrls: string[];
    isFeatured: boolean;
    createdAt: Timestamp;
}

// Tipe Data untuk Booking (Sudah Ada)
export interface Booking { 
    id: string;
    guestName: string; 
    guestPhone: string; 
    guestEmail?: string;
    packageId: string; 
    packageName: string; 
    pax: number; 
    tripDate: string; 
    totalAmount: number; 
    paymentStatus: 'pending' | 'paid' | 'cancelled';
    notes?: string; 
    source: 'manual' | 'website'; 
    createdAt: Timestamp;
    customDuration?: string; customLocation?: string; customFeatures?: string;
    customExclusions?: string; customItinerary?: string; ref?: string;
}

// Tipe Data untuk Ringkasan Dashboard (Diperbarui dari StatData)
export interface DashboardSummary {
    totalTrips: number; // Menggantikan totalPackages
    totalBookings: number;
    totalRevenue: number;
}

// Tipe Data untuk Testimonial (Sudah Ada)
export type Testimonial = {
  id: string;
  name: string;
  message: string;
  rating: number;
  createdAt: number; 
};