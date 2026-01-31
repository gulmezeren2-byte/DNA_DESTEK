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
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        return { success: true, downloadURL };
    } catch (error: any) {
        console.error("Upload error:", error);
        return { success: false, message: error.message };
    }
};
