import {
    getDownloadURL,
    ref,
    uploadBytes
} from "firebase/storage";
import { storage } from "../firebaseConfig";

export const uploadImage = async (uri: string, path: string) => {
    try {
        const response = await fetch(uri);
        const blob = await response.blob();

        // VALIDATION
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        if (blob.size > MAX_SIZE) {
            return { success: false, message: "Dosya boyutu çok büyük (Maks 5MB)." };
        }
        if (!blob.type.startsWith('image/')) {
            return { success: false, message: "Sadece resim dosyaları yüklenebilir." };
        }

        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        return { success: true, downloadURL };
    } catch (error: any) {
        console.error("Upload error:", error);
        return { success: false, message: error.message };
    }
};
