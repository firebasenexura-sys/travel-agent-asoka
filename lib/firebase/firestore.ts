// lib/firebase/firestore.ts
import { db } from "./config"; // <-- Pastikan path ini benar
import { collection, query, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { Booking, TripPackage, DashboardSummary } from "./types";

// Fungsi untuk mendapatkan booking terbaru (digunakan di dashboard)
export async function getRecentBookings(limitCount: number = 5): Promise<Booking[]> {
    try {
        const bookingsCol = collection(db, 'bookings');
        const q = query(bookingsCol, orderBy('createdAt', 'desc'), limit(limitCount));
        const bookingSnapshot = await getDocs(q);

        const bookings: Booking[] = bookingSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                guestName: data.guestName || 'N/A',
                guestPhone: data.guestPhone || 'N/A',
                packageId: data.packageId || '',
                packageName: data.packageName || '',
                pax: data.pax || 0,
                tripDate: data.tripDate || 'N/A',
                totalAmount: data.totalAmount || 0,
                paymentStatus: data.paymentStatus || 'pending',
                source: data.source || 'manual',
                createdAt: data.createdAt as Timestamp,
            } as Booking;
        });

        return bookings;
    } catch (error) {
        console.error("Error fetching recent bookings:", error);
        return [];
    }
}

// Fungsi untuk mendapatkan semua trip package
export async function getTripPackages(): Promise<TripPackage[]> {
    try {
        const tripsCol = collection(db, 'packages');
        const q = query(tripsCol, orderBy('createdAt', 'desc'));
        const tripSnapshot = await getDocs(q);

        const trips: TripPackage[] = tripSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                packageName: data.packageName,
                description: data.description,
                duration: data.duration,
                price: data.price,
                destination: data.destination,
                imageUrls: data.imageUrls || [],
                isFeatured: data.isFeatured || false,
                createdAt: data.createdAt as Timestamp,
            } as TripPackage;
        });
        return trips;
    } catch (error) {
        console.error("Error fetching trip packages:", error);
        return [];
    }
}

// Fungsi untuk mendapatkan ringkasan data dashboard (Data Dummy)
export async function getDashboardSummary(): Promise<DashboardSummary> {
    // Simulasi delay saat fetching data dari Firestore
    await new Promise(resolve => setTimeout(resolve, 500)); 
    return {
        totalTrips: 45, // Angka dummy, ganti dengan logic nyata
        totalBookings: 128, 
        totalRevenue: 52000000, 
    };
}