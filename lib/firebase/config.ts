// lib/firebase/config.js

import { initializeApp } from "firebase/app";
// Import layanan yang akan kita gunakan
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Catatan: Ganti dengan konfigurasi proyek Firebase Anda yang sudah disimpan
const firebaseConfig = {
  apiKey: "AIzaSyBdKqLcrk_iA_8kXCVEcN3r5uDBiZTly3Y",
  authDomain: "travelagent-asoka.firebaseapp.com",
  projectId: "travelagent-asoka",
  storageBucket: "travelagent-asoka.firebasestorage.app",
  messagingSenderId: "1083864482880",
  appId: "1:1083864482880:web:25cbd9961295d9c3900ba5",
  measurementId: "G-SYV591R20B"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Inisialisasi Layanan
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Selesai!