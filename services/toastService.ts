/**
 * DNA DESTEK - Toast Notification Service
 * Profesyonel bildirim servisi
 */

import { Platform } from 'react-native';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastConfig {
    message: string;
    type: ToastType;
    duration?: number;
}

// Toast stilleri
const TOAST_STYLES: Record<ToastType, { icon: string; color: string }> = {
    success: { icon: '✅', color: '#10b981' },
    error: { icon: '❌', color: '#ef4444' },
    info: { icon: 'ℹ️', color: '#3b82f6' },
    warning: { icon: '⚠️', color: '#f59e0b' },
};

/**
 * Platformlar arası Toast bildirimi göster
 */
export const showToast = ({ message, type, duration = 3000 }: ToastConfig): void => {
    const style = TOAST_STYLES[type];
    const fullMessage = `${style.icon} ${message}`;

    if (Platform.OS === 'web') {
        // Web için özel styled toast
        showWebToast(fullMessage, style.color, duration);
    } else {
        // Mobile için alert (daha sonra native toast ile değiştirilebilir)
        // React Native Toast kütüphanesi kurulduğunda burayı güncelleyebiliriz
        console.log(`[Toast - ${type.toUpperCase()}]`, message);
    }
};

/**
 * Web için özel toast gösterimi
 */
const showWebToast = (message: string, color: string, duration: number): void => {
    if (typeof document === 'undefined') return;

    // Container oluştur veya mevcut olanı kullan
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
        document.body.appendChild(container);
    }

    // Toast elementi
    const toast = document.createElement('div');
    toast.style.cssText = `
    padding: 14px 20px;
    background: ${color};
    color: white;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease-out;
    pointer-events: auto;
    max-width: 350px;
  `;
    toast.textContent = message;

    // Animasyon stili ekle
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
        document.head.appendChild(style);
    }

    container.appendChild(toast);

    // Belirtilen süre sonra kaldır
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            toast.remove();
            // Container boşsa kaldır
            if (container && container.children.length === 0) {
                container.remove();
            }
        }, 300);
    }, duration);
};

// Kısayol fonksiyonları
export const toast = {
    success: (message: string) => showToast({ message, type: 'success' }),
    error: (message: string) => showToast({ message, type: 'error' }),
    info: (message: string) => showToast({ message, type: 'info' }),
    warning: (message: string) => showToast({ message, type: 'warning' }),
};

export default toast;
