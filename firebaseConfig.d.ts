import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { Storage } from 'firebase/storage';

export const auth: Auth;
export const db: Firestore;
export const storage: Storage;

export interface Result {
    success: boolean;
    message?: string;
}

export interface UserResult extends Result {
    user?: any;
    users?: any[];
}

export interface EkipResult extends Result {
    ekipler?: any[];
    id?: string;
}

export function logoutUser(): Promise<Result>;
export function getAllEkipler(): Promise<EkipResult>;
export function getActiveEkipler(): Promise<EkipResult>;
export function getAllUsers(): Promise<UserResult>;

export function createTalep(talepData: any): Promise<Result & { id?: string }>;
export function getTalepler(userId: string, rol: string): Promise<Result & { talepler?: any[] }>;
export function updateTalepDurum(talepId: string, yeniDurum: string): Promise<Result>;
export function puanlaTalep(talepId: string, puan: number, yorum: string): Promise<Result>;
export function uploadImage(uri: string, path: string): Promise<Result & { downloadURL?: string }>;
export function getProjeler(): Promise<Result & { projeler?: any[] }>;
export function assignTalepToEkip(talepId: string, ekipId: string, ekipAdi: string): Promise<Result>;
export function saveEkip(ekipData: any): Promise<Result>;
export function createEkip(ekipData: any): Promise<Result & { id?: string }>;
export function updateEkip(ekipId: string, data: any): Promise<Result>;
export function deleteEkip(ekipId: string): Promise<Result>;
export function addUserToEkip(ekipId: string, userId: string): Promise<Result>;
export function removeUserFromEkip(ekipId: string, userId: string): Promise<Result>;
export function createDefaultEkipler(): Promise<Result>;

export function createUser(userData: any, creatorEmail: string, adminAuthPassword?: string): Promise<Result>;
export function updateUser(userId: string, data: any): Promise<Result>;
export function loginUser(email: string, password: string): Promise<UserResult>;
export function getCurrentUser(): Promise<any>;
export function onAuthChange(callback: (user: any) => void): import('firebase/auth').Unsubscribe;
