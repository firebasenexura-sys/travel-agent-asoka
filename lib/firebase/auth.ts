// lib/firebase/auth.ts (FULL PATCHED)

import { auth } from './config';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail,
} from 'firebase/auth';

/**
 * Fungsi untuk melakukan login admin
 * @param {string} email 
 * @param {string} password 
 */
export async function adminSignIn(email: string, password: string) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error: any) { // <<< FIX 1: Tangkap error sebagai 'any'
        console.error("Login error:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Fungsi untuk logout admin
 */
export async function adminSignOut() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error: any) { // <<< FIX 2: Tangkap error sebagai 'any'
        console.error("Logout error:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Fungsi untuk mengirim email reset password
 * @param {string} email 
 */
export async function resetPassword(email: string) { // <<< FIX 3: Tambahkan ': string'
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error: any) { // <<< FIX 4: Tangkap error sebagai 'any'
        console.error("Reset password error:", error.message);
        return { success: false, error: error.message };
    }
}