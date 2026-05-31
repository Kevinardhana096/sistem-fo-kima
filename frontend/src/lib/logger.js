/**
 * Centralized logger.
 *
 * Routing all logging through here (instead of calling console.* directly)
 * gives a single place to silence, format, or forward logs later (e.g. to a
 * monitoring service). Errors and warnings are always emitted; info/debug are
 * only emitted in development builds.
 */
const isDev = Boolean(import.meta.env.DEV);

export const logger = {
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    info: (...args) => {
        if (isDev) console.info(...args);
    },
    debug: (...args) => {
        if (isDev) console.debug(...args);
    },
};

export default logger;
