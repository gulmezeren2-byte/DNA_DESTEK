import {
    addDoc,
    collection,
    deleteDoc, // Standard delete
    doc,
    getDocs,
    updateDoc
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Proje, ServiceResponse } from "../types";

export const getProjeler = async (): Promise<ServiceResponse<Proje[]>> => {
    try {
        const snap = await getDocs(collection(db, "projeler"));
        const projeler = snap.docs.map(d => ({ id: d.id, ...d.data() } as Proje));
        return { success: true, data: projeler };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const createProje = async (projeData: Omit<Proje, 'id'>): Promise<ServiceResponse<void>> => {
    try {
        await addDoc(collection(db, "projeler"), projeData);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const updateProje = async (id: string, projeData: Partial<Proje>): Promise<ServiceResponse<void>> => {
    try {
        await updateDoc(doc(db, "projeler", id), projeData);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const deleteProje = async (id: string): Promise<ServiceResponse<void>> => {
    try {
        await deleteDoc(doc(db, "projeler", id));
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};
