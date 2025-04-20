// utils.js

/**
 * Displays a toast message.
 * @param {string} m - The message to display.
 * @param {'info' | 'success' | 'error'} t - The type of toast.
 */
function showToast(m, t = 'info') {
    let toastMessage = document.getElementById('toast-message');
    if (!toastMessage) {
        toastMessage = document.createElement('div');
        toastMessage.id = 'toast-message';
        document.body.appendChild(toastMessage);
    }
    toastMessage.textContent = m;
    toastMessage.className = 'toast'; // Base class
    if (t === 'success') toastMessage.classList.add('success');
    else if (t === 'error') toastMessage.classList.add('error');

    // Clear previous timeouts if any
    if (window.toastTimeout) {
        clearTimeout(window.toastTimeout);
    }

    // Force reflow to restart animation if needed
    toastMessage.offsetHeight;

    toastMessage.classList.add('show');
    window.toastTimeout = setTimeout(() => {
        toastMessage.classList.remove('show');
    }, 3000);
}


/**
 * Loads data (browserdata, account_data) from localStorage.
 * Initializes browserdata if it doesn't exist.
 * @returns {{browserdata: object, account_data: object | null}} Loaded data.
 */
function loadBrowserAndAccountData() {
    let browserdata = {};
    let account_data = null;
    try {
        const d = localStorage.getItem('browserdata');
        const a = localStorage.getItem('account_data');

        if (d) {
            browserdata = JSON.parse(d);
            browserdata.saved = browserdata.saved || [];
            browserdata.streak = browserdata.streak || {};
            browserdata.streak.data = browserdata.streak.data || [0, 0, 0, 0, 0, 0, 0];
            browserdata.streak.goal = browserdata.streak.goal || 6e5; // 10 minutes
            browserdata.streak.date = browserdata.streak.date || getTimeSince2000('days');
            // Sort sets by opened date (most recent first)
            browserdata.saved.sort((x, y) => new Date(y.opened || 0).getTime() - new Date(x.opened || 0).getTime());
        } else {
            browserdata = {
                streak: { data: [0, 0, 0, 0, 0, 0, 0], goal: 6e5, date: getTimeSince2000('days'), current: 0 },
                saved: []
            };
        }

        if (a) {
            account_data = JSON.parse(a);
        } else {
            account_data = null;
        }

    } catch (e) {
        console.error("Load browser data err:", e);
        // Reset to default if loading fails
        browserdata = {
            streak: { data: [0, 0, 0, 0, 0, 0, 0], goal: 6e5, date: getTimeSince2000('days'), current: 0 },
            saved: []
        };
        account_data = null;
        localStorage.setItem('browserdata', JSON.stringify(browserdata));
        localStorage.setItem('account_data', JSON.stringify(account_data)); // Save null if needed
    }
    return { browserdata, account_data };
}


/**
 * Saves browserdata and account_data to localStorage.
 * @param {object} browserdata - The browser data object.
 * @param {object | null} account_data - The account data object.
 */
function saveBrowserAndAccountData(browserdata, account_data) {
    try {
        // Ensure sets are sorted before saving
        if (browserdata && browserdata.saved) {
            browserdata.saved.sort((a, b) => new Date(b.opened || 0).getTime() - new Date(a.opened || 0).getTime());
        }
        localStorage.setItem('browserdata', JSON.stringify(browserdata || {}));
        localStorage.setItem('account_data', JSON.stringify(account_data || null));
    } catch (e) {
        console.error("Save browser data err:", e);
    }
}

/**
 * Resets browserdata to defaults and saves.
 * @returns {object} The reset browserdata object.
 */
function hardResetBrowserData() {
    const browserdata = {
        streak: { data: [0, 0, 0, 0, 0, 0, 0], goal: 6e5, date: getTimeSince2000('days'), current: 0 },
        saved: []
    };
    saveBrowserAndAccountData(browserdata, loadBrowserAndAccountData().account_data); // Keep account data
    showToast("Browser data reset.");
    return browserdata;
}


/**
 * Formats a date string or Date object into a readable string.
 * @param {string | Date} d - The date string or object.
 * @returns {string} Formatted date string or "Invalid Date".
 */
function formatDate(d) {
    try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return "Invalid Date";
        // Example format: Jan 1, 10:30 PM
        return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) {
        console.error("Error formatting date:", d, e);
        return "Invalid Date";
    }
}

/**
 * Generates a consistent HSL color based on a string input.
 * @param {string} t - The input string.
 * @returns {string} An HSL color string.
 */
function textToColor(t) {
    if (!t) return 'hsl(0, 0%, 50%)'; // Default grey
    let hash = 0;
    for (let i = 0; i < t.length; i++) {
        hash = t.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // Convert to 32bit integer
    }
    const hue = Math.abs(hash % 360);
    // Keep saturation and lightness relatively constant for a consistent theme
    const saturation = 65 + Math.abs(hash % 15); // 65-80%
    const lightness = 45 + Math.abs(hash % 10); // 45-55%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Calculates contrast color (black or white) for a given HSL color.
 * @param {string} color - The HSL color string (e.g., "hsl(120, 50%, 50%)").
 * @returns {'#000000' | '#FFFFFF'} Black or White hex code.
 */
function getContrastColor(color) {
    try {
        const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (!hslMatch) {
            console.warn("getContrastColor: Invalid HSL format", color);
            return '#000000'; // Default to black if format is wrong
        }
        let h = parseInt(hslMatch[1]);
        let s = parseInt(hslMatch[2]) / 100;
        let l = parseInt(hslMatch[3]) / 100;

        // Formula to convert HSL to RGB (needed for luminance calculation)
        let c = (1 - Math.abs(2 * l - 1)) * s;
        let x = c * (1 - Math.abs((h / 60) % 2 - 1));
        let m = l - c / 2;
        let r = 0, g = 0, b = 0;

        if (0 <= h && h < 60) { r = c; g = x; b = 0; }
        else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
        else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
        else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
        else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
        else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);

        // Calculate luminance (per WCAG guidelines)
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

        // Return black for light backgrounds, white for dark backgrounds
        return luminance >= 0.5 ? '#000000' : '#FFFFFF';
    } catch (e) {
        console.error("Contrast color calculation error:", color, e);
        return '#000000'; // Fallback to black
    }
}


/**
 * Gets the number of units (seconds, minutes, hours, days) passed since Jan 1, 2000.
 * @param {'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days'} unit - The desired unit.
 * @returns {number} The time difference in the specified unit.
 */
function getTimeSince2000(unit = 'milliseconds') {
    const start = new Date("2000-01-01T00:00:00Z").getTime();
    const now = Date.now();
    const diff = now - start;

    switch (unit) {
        case "seconds": return Math.floor(diff / 1000);
        case "minutes": return Math.floor(diff / 60000);
        case "hours": return Math.floor(diff / 3600000);
        case "days": return Math.floor(diff / 86400000);
        default: return diff; // milliseconds
    }
}

/**
 * Updates the streak data in browserdata if the day has changed.
 * @param {object} browserdata - The browser data object to update.
 * @returns {boolean} True if the streak was updated, false otherwise.
 */
function updateStreakData(browserdata) {
    if (!browserdata || !browserdata.streak) return false;

    const currentDay = getTimeSince2000("days");
    const lastStreakDay = browserdata.streak.date || currentDay; // Initialize if missing

    if (currentDay > lastStreakDay) {
        const daysDiff = currentDay - lastStreakDay;
        console.log(`Day changed. Shifting streak by ${daysDiff} day(s).`);

        if (!Array.isArray(browserdata.streak.data)) {
            browserdata.streak.data = [0, 0, 0, 0, 0, 0, 0];
        }

        // Shift data and add zeros for the missed days
        for (let d = 0; d < daysDiff && browserdata.streak.data.length > 0; d++) {
            browserdata.streak.data.shift(); // Remove oldest day
            browserdata.streak.data.push(0);   // Add a zero for the new day
        }
        // Ensure array length is always 7
        while (browserdata.streak.data.length < 7) browserdata.streak.data.unshift(0);
        browserdata.streak.data = browserdata.streak.data.slice(-7); // Keep only last 7 days

        browserdata.streak.date = currentDay; // Update the date marker
        return true; // Data was updated
    } else if (lastStreakDay > currentDay) {
        // This case shouldn't happen normally (clock set back?)
        console.warn("Streak date is in the future. Resetting date.");
        browserdata.streak.date = currentDay;
        return true; // Data was updated (date corrected)
    }
    return false; // No update needed
}

/**
 * Adds time elapsed since sessionStartTime to today's streak count.
 * Requires sessionStartTime to be set elsewhere.
 * @param {object} browserdata - The browser data object.
 * @param {number} sessionStartTime - The timestamp when the study session started.
 */
function addToStreakToday(browserdata, sessionStartTime) {
    if (!sessionStartTime || sessionStartTime > Date.now()) {
        console.warn("addToStreakToday: Invalid sessionStartTime.");
        return;
    };
    if (!browserdata || !browserdata.streak) {
        console.warn("addToStreakToday: Missing browserdata or streak object.");
        return;
    }

    // Ensure streak data is up-to-date before adding
    updateStreakData(browserdata);

    const timeElapsed = Date.now() - sessionStartTime;

    if (timeElapsed > 0) {
        if (!Array.isArray(browserdata.streak.data) || browserdata.streak.data.length === 0) {
            // Initialize if somehow it's invalid
            browserdata.streak.data = [0, 0, 0, 0, 0, 0, 0];
            console.warn("addToStreakToday: Initialized missing streak data array.");
        }
        // Add to the last element (today)
        const todayIndex = browserdata.streak.data.length - 1;
        if (todayIndex >= 0) {
            browserdata.streak.data[todayIndex] = (Number(browserdata.streak.data[todayIndex]) || 0) + timeElapsed;
        }
    }
    // Note: We don't reset sessionStartTime here, that should be done by the calling code
    // after saving.
}

/**
 * Parses raw flashcard data string (question|answer|question|answer...) into JSON.
 * @param {string} s - The raw string data.
 * @returns {Array<object>} Array of card objects { question, answer, rating }.
 */
function rawFlashcardsToJSON(s) {
    if (!s || typeof s !== 'string') return [];
    const parts = s.split("|");
    const flashcards = [];
    for (let i = 0; i < parts.length; i += 2) {
        const question = parts[i]?.trim();
        // Handle cases where the last item might be a question without an answer
        const answer = (i + 1 < parts.length) ? (parts[i + 1]?.trim() ?? "") : "";
        if (question) { // Only add if there's a question
            flashcards.push({ question: question, answer: answer, rating: 0 });
        }
    }
    return flashcards;
}

function expMap(value, minvalue, maxvalue, minout, maxout, exp) {
    // First, let's figure out where the input 'value' is within its range (from minvalue to maxvalue).
    // We'll get a number between 0 and 1.
    const normalizedValue = (value - minvalue) / (maxvalue - minvalue);

    // Now, we'll apply the exponential function to this normalized value.
    // Math.pow(normalizedValue, exp) raises 'normalizedValue' to the power of 'exp'.
    // If 'exp' is greater than 1, values closer to 1 will be stretched out.
    // If 'exp' is less than 1 (but greater than 0), values closer to 0 will be stretched out.
    const exponentialValue = Math.pow(normalizedValue, exp);

    // Finally, we need to map this exponential value (which is still between 0 and 1)
    // to the desired output range (from minout to maxout).
    const outputValue = minout + exponentialValue * (maxout - minout);

    return outputValue;
}