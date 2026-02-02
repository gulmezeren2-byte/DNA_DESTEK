

type LogLevel = 'info' | 'warn' | 'error';

class LogService {
    private static isDev = __DEV__;

    private static formatMessage(level: LogLevel, message: string, data?: any) {
        const timestamp = new Date().toISOString();
        return {
            timestamp,
            level,
            message,
            data
        };
    }

    static info(message: string, data?: any) {
        if (this.isDev) {
            console.log(`ℹ️ [${new Date().toLocaleTimeString()}] ${message}`, data || '');
        }
        // TODO: Sentry.captureMessage(message, 'info');
    }

    static warn(message: string, data?: any) {
        if (this.isDev) {
            console.warn(`⚠️ [${new Date().toLocaleTimeString()}] ${message}`, data || '');
        }
        // TODO: Sentry.captureMessage(message, 'warning');
    }

    static error(message: string, error?: any, data?: any) {
        if (this.isDev) {
            console.error(`🚨 [${new Date().toLocaleTimeString()}] ${message}`, error || '', data || '');
        }
        // TODO: Sentry.captureException(error, { extra: { message, ...data } });
    }
}

export default LogService;
