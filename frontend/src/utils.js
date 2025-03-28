// frontend/src/utils.js

// --- Debounce Function ---
export function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

// --- Helper: Linear Interpolation (Lerp) ---
export function lerp(start, end, factor) {
    // Clamp factor between 0 and 1
    factor = Math.max(0, Math.min(1, factor));
    return start + (end - start) * factor;
}

// Simple deep clone helper
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    // Basic JSON stringify/parse for deep clone
    // Be aware of limitations (Dates, Functions, Regexps, undefined won't clone correctly)
    try {
       return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        console.error("Deep clone failed:", e);
        return null; // Or handle error appropriately
    }
}

// Add hashcode helper if not already present
export function initializeHashCode() {
    if (!String.prototype.hashCode) {
        String.prototype.hashCode = function() {
          var hash = 0, i, chr; if (this.length === 0) return hash;
          for (i = 0; i < this.length; i++) { chr = this.charCodeAt(i); hash = ((hash << 5) - hash) + chr; hash |= 0; }
          return hash;
        };
        console.log("String.prototype.hashCode initialized.");
    }
}