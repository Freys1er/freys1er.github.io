// script.js (Base Folder - Home)

document.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    let browserdata = {};
    let account_data = null;
    let sessionStartTime = Date.now(); // Track time spent on this page load

    // --- DOM Elements ---
    const loadingOverlay = document.getElementById('loading-overlay');
    const homeGreeting = document.getElementById('home-greeting');
    const homeMessage = document.getElementById('home-message');
    const accountButton = document.getElementById('account-button');
    const accountIcon = document.getElementById('account-icon');
    const searchInput = document.getElementById('home-search-input');
    const streakCirclesContainer = document.getElementById('streak-circles');
    const recentSetsList = document.getElementById('recent-sets-list');
    const likedSetsList = document.getElementById('liked-sets-list');

    // Tab buttons
    const tabButtons = document.querySelectorAll('.secondary-nav .tab-button');
    const tabContents = document.querySelectorAll('.tab-content .tab-content-section');


    // --- Initialization ---
    function init() {
        showLoading(); // Show loading indicator immediately

        // Load data from localStorage
        const loadedData = loadBrowserAndAccountData(); // From utils.js
        browserdata = loadedData.browserdata;
        account_data = loadedData.account_data;

        setupEventListeners();
        updateGreetingAndMessage();
        updateUserIcon(); // Update icon based on loaded account_data
        renderStreak();
        renderRecentSets();
        renderLikedSets();

        // Check if streak data needs updating
        if (updateStreakData(browserdata)) { // From utils.js
            saveBrowserAndAccountData(browserdata, account_data); // From utils.js
            renderStreak(); // Re-render if updated
        }

        // Fetch latest user data from server if logged in
        if (account_data && account_data.token) {
            getUserDataFromServer();
        }
        hideLoading(); // Hide loading if no server fetch needed

        // Add time tracking on page unload/hide
        window.addEventListener('beforeunload', trackSessionTime);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                trackSessionTime();
            } else {
                sessionStartTime = Date.now(); // Reset timer when page becomes visible again
            }
        });

        searchInput.focus();
    }

    function showLoading() {
        if (loadingOverlay) loadingOverlay.classList.add('visible');
    }
    function hideLoading() {
        if (loadingOverlay) loadingOverlay.classList.remove('visible');
    }

    // --- Server Data Fetch ---
    function getUserDataFromServer() {
        if (!account_data || !account_data.token) {
            hideLoading();
            return; // Not logged in
        }
        // Assume 'server' function exists globally (from server.js)
        doGet(account_data.token, "getUserData", {})
            .then(serverResponse => {
                if (serverResponse && serverResponse.userData) {
                    account_data.serverInfo = serverResponse.userData;
                    saveBrowserAndAccountData(browserdata, account_data); // Save updated data
                    console.log("User data updated:", account_data.serverInfo);

                    if (serverResponse?.status === 'ok') {
                        safeReplace("Google");
                    }

                    updateUserIcon(); // Update icon with potentially new picture URL
                    updateGreetingAndMessage(); // Update greeting with username
                } else {
                    console.warn("getUserData response missing userData field.");
                }
            })
            .catch(error => {
                console.error("Error fetching user data:", error.message);
                // Optional: show toast to user
                // showToast("Could not update user data.", "error");
            })
            .finally(() => {
                hideLoading(); // Hide loading after fetch attempt
            });
    }

    // --- Rendering Functions ---
    function updateGreetingAndMessage() {
        if (!homeGreeting || !homeMessage) return;
        const h = new Date().getHours();
        let greeting = "Hello";
        if (h < 6) greeting = "Good night";
        else if (h < 12) greeting = "Good morning";
        else if (h < 18) greeting = "Good afternoon";
        else greeting = "Good evening";

        // Try getting username from serverInfo first, then userInfo
        let username = account_data?.serverInfo?.username || account_data?.userInfo?.name;
        let namePart = username ? `, ${username}!` : "!";
        homeGreeting.textContent = greeting + namePart;

        // Simple messages based on time
        const messages = {
            midnight: [
                "Burning the midnight oil?",
                "Late night coding session?",
                "Still hustling?",
                "Deep in thought?",
                "Quiet hours productivity?"
            ],
            morning: [
                "Ready for the day?",
                "Good morning! Coffee first?",
                "What's the plan for today?",
                "Rise and shine!",
                "Hope you have a great start!"
            ],
            afternoon: [ // Corrected spelling
                "Productive afternoon?",
                "Hitting your stride?",
                "How's the day progressing?",
                "Need a mid-day boost?",
                "Making good progress?"
            ],
            evening: [
                "Winding down?",
                "Time to relax?",
                "How was your day?",
                "Wrapping things up?",
                "Ready for a quiet evening?"
            ]
        };

        let message = getRandomMessage(messages.morning); // Default: Ready for the day?
        if (h < 6) message = getRandomMessage(messages.midnight);
        else if (h < 12) message = getRandomMessage(messages.morning);
        else if (h < 18) message = getRandomMessage(messages.evening);
        else message = getRandomMessage(messages.midnight);
        homeMessage.textContent = message;
    }

    function getRandomMessage(timeOfDayArray) {
        // Ensure the array is not empty
        if (!timeOfDayArray || timeOfDayArray.length === 0) {
            return "No messages available."; // Or handle as needed
        }

        // Generate a random index from 0 up to (but not including) the array length
        const randomIndex = Math.floor(Math.random() * timeOfDayArray.length);

        // Return the message at that random index
        return timeOfDayArray[randomIndex];
    }

    function updateUserIcon() {
        if (!accountIcon) return;
        // Prefer serverInfo picture, fallback to userInfo picture
        const pictureUrl = account_data?.serverInfo?.picture || account_data?.userInfo?.picture;
        if (pictureUrl && typeof pictureUrl === 'string' && pictureUrl.trim() !== '') {
            accountIcon.src = pictureUrl;
            accountIcon.onerror = () => { // Fallback if image fails to load
                console.warn("Failed to load user icon:", pictureUrl);
                accountIcon.src = '../icons/account.svg';
            };
            setUserIconStyle(); // Apply styles if we have a custom icon
        } else {
            accountIcon.src = '../icons/account.svg'; // Default icon
            accountIcon.onerror = null; // Remove error handler for default
            resetUserIconStyle(); // Reset styles if using default
        }
    }

    function setUserIconStyle() {
        if (!accountIcon) return;
        accountIcon.style.width = '40px';
        accountIcon.style.height = '40px';
        accountIcon.style.objectFit = 'cover';
        accountIcon.style.borderRadius = '50%';
        accountIcon.style.border = '1px solid var(--text-muted-color)';
    }

    function resetUserIconStyle() {
        if (!accountIcon) return;
        // Reset styles potentially applied by setUserIconStyle
        accountIcon.style.width = '';
        accountIcon.style.height = '';
        accountIcon.style.objectFit = '';
        accountIcon.style.borderRadius = '';
        accountIcon.style.border = '';
    }

    function renderStreak() {
        if (!streakCirclesContainer || !browserdata.streak) return;
        streakCirclesContainer.innerHTML = ''; // Clear previous circles
        const today = new Date();
        const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const streakData = browserdata.streak.data || [];
        const goal = browserdata.streak.goal || 6e5; // Default 10 mins

        // Ensure streak data has 7 elements, padding with 0s if necessary
        let displayData = [...streakData];
        while (displayData.length < 7) displayData.unshift(0);
        if (displayData.length > 7) displayData = displayData.slice(-7);

        for (let i = 0; i < 7; i++) {
            const timeStudied = displayData[i] || 0;
            const percentage = goal > 0 ? Math.min(100, (timeStudied / goal) * 100) : 0;

            // Calculate the date for this circle (0 = Sun, ..., 6 = Sat)
            const dateOfCircle = new Date(today);
            dateOfCircle.setDate(today.getDate() - (6 - i)); // i=6 is today, i=0 is 6 days ago

            const dayContainer = document.createElement('div');
            dayContainer.className = 'streak-day';

            const circle = document.createElement('div');
            circle.className = 'streak-circle';
            circle.textContent = dateOfCircle.getDate(); // Day number

            // Add state classes based on progress
            if (timeStudied >= goal) {
                circle.classList.add('complete');
            } else if (timeStudied > 0) {
                circle.classList.add('in-progress');
            } else {
                circle.classList.add('empty');
            }

            // SVG Progress Ring
            const progressRing = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            progressRing.setAttribute("viewBox", "0 0 36 36");
            progressRing.classList.add('streak-progress-ring');

            const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            bgCircle.setAttribute("cx", "18"); bgCircle.setAttribute("cy", "18");
            bgCircle.setAttribute("r", "15.915"); // Radius for circumference of 100
            bgCircle.classList.add('ring-bg');

            const progCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            progCircle.setAttribute("cx", "18"); progCircle.setAttribute("cy", "18");
            progCircle.setAttribute("r", "15.915");
            progCircle.classList.add('ring-progress');
            // Calculate stroke-dashoffset: 100 is empty, 0 is full
            progCircle.style.strokeDashoffset = 100 - percentage;

            progressRing.appendChild(bgCircle);
            progressRing.appendChild(progCircle);
            circle.appendChild(progressRing);

            const label = document.createElement('span');
            label.textContent = daysOfWeek[dateOfCircle.getDay()]; // Day name

            dayContainer.appendChild(circle);
            dayContainer.appendChild(label);
            streakCirclesContainer.appendChild(dayContainer);
        }
    }

    function renderRecentSets() {
        if (!recentSetsList || !browserdata.saved) return;
        recentSetsList.innerHTML = ''; // Clear previous

        // 1. "Create New" Item
        const newSetItem = document.createElement('li');
        newSetItem.className = 'set-item create-new-item';
        newSetItem.innerHTML = `
            <div class="set-thumbnail">+</div>
            <div class="set-details">
                <div class="set-title">Create New Set</div>
                <div class="set-message">Start with a blank slate</div>
            </div>`;
        newSetItem.addEventListener('click', () => {
            // Redirect to Preview page with a flag for creating new
            safeReplace('Flow/Preview/?new=true');
        });
        recentSetsList.appendChild(newSetItem);

        // 2. Recently Opened Sets (limit to maybe 10?)
        const maxRecentSets = 10;
        browserdata.saved.slice(0, maxRecentSets).forEach((set) => {
            // Make sure set has an ID, generate one if missing (though ideally backend provides it)
            if (!set.setId) {
                console.warn("Set missing setId, generating temporary one:", set.name);
                set.setId = 'local_' + Date.now() + Math.random().toString(16).substring(2);
                // Consider saving this back immediately if needed for consistency
            }
            const li = createSetListItem(set);
            recentSetsList.appendChild(li);
        });
    }

    function renderLikedSets() {
        if (!likedSetsList || !browserdata.saved) return;
        likedSetsList.innerHTML = ''; // Clear previous

        // 1. "Create New" Item
        const newSetItem = document.createElement('li');
        newSetItem.className = 'set-item create-new-item';
        newSetItem.innerHTML = `
            <div class="set-thumbnail">+</div>
            <div class="set-details">
                <div class="set-title">Create New Set</div>
                <div class="set-message">Start with a blank slate</div>
            </div>`;
        newSetItem.addEventListener('click', () => {
            // Redirect to Preview page with a flag for creating new
            safeReplace('Flow/Preview/?new=true');
        });
        likedSetsList.appendChild(newSetItem);

        // 2. Recently Opened Sets (limit to maybe 10?)
        const maxRecentSets = 10;
        browserdata.saved.slice(0, maxRecentSets).forEach((set) => {
            // Make sure set has an ID, generate one if missing (though ideally backend provides it)
            if (!set.setId) {
                console.warn("Set missing setId, generating temporary one:", set.name);
                set.setId = 'local_' + Date.now() + Math.random().toString(16).substring(2);
                // Consider saving this back immediately if needed for consistency
            }
            const li = createSetListItem(set);
            likedSetsList.appendChild(li);
        });
    }

    /** Creates a list item for a set */
    function createSetListItem(set) {
        const li = document.createElement('li');
        li.className = 'set-item';
        li.dataset.setId = set.setId; // Store the set ID

        const color = set.color || textToColor(set.name || ''); // from utils.js
        const textColor = getContrastColor(color); // from utils.js
        const count = Array.isArray(set.data) ? set.data.length : (set.count || 0); // Prefer actual data length
        const message = `Opened: ${set.opened ? formatDate(set.opened) : 'Never'}`; // from utils.js

        li.innerHTML = `
            <div class="set-thumbnail" style="background-color: ${color}; color: ${textColor};">${count}</div>
            <div class="set-details">
                <div class="set-title">${set.name || 'Untitled Set'}</div>
                <div class="set-message">${message}</div>
            </div>`;

        li.addEventListener('click', () => {
            trackSessionTime(); // Track time before navigating away
            // Redirect to Preview page with the set ID
            safeReplace(`Flow/Preview/?setId=${set.setId}`)
        });
        return li;
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        //Tab buttons

        // Tab Switching Logic
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                switchTab(button.getAttribute('data-tab'));
            });
        });


        // Search Input
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && searchInput.value.trim()) {
                    trackSessionTime(); // Track time before navigating
                    // Redirect to Search page with the query
                    safeReplace(`Flow/Search/?query=${encodeURIComponent(searchInput.value.trim())}`);
                }
            });
        }

        // Account Icon Click
        if (accountButton) {
            accountButton.addEventListener('click', () => {
                // Redirect to Profile page (assuming current user's profile)
                // If account_data.serverInfo.userId exists, use it?
                // For now, just go to the base profile page. It can fetch the logged-in user's data.
                const userId = account_data?.serverInfo?.userId || account_data?.userInfo?.sub; // Use serverInfo ID or Google ID
                if (userId) {
                    trackSessionTime();
                    safeReplace(`Flow/Profile/?userId=${userId}`); // Redirect to Profile page with userId
                } else {
                    // Handle case where user ID isn't available (e.g., not logged in fully)
                    // Maybe prompt login or show a generic message
                    showToast("Please log in to view profile.", "info");
                    // Optionally redirect to login page
                    safeReplace("Google/?redirect=Flow/Profile");
                }
            });
        }

        //Top for you / quick study list item buttons (top 100, google gemini, statistics, questions and help)
        const quickStudyButtons = document.querySelectorAll('#foryou-sets-list .quick-item');
        quickStudyButtons.forEach(button => {
            button.addEventListener('click', () => {
                const action = button.getAttribute('data-action');
                if (action) {
                    trackSessionTime(); // Track time before navigating
                    initiateQuickStudy(action); // Call the function to handle the action
                }
            });
        });

    }

    function initiateQuickStudy(action) {
        switch (action) {
            case 'top-100':
                createTop100List();
                break;
            case 'google-gemini':
                safeReplace('Flow/Gemini');
                break;
            case 'statistics':
                safeReplace('Flow/Statistics');
                break;
            case 'help':
                safeReplace('Flow/Help');
                break;
            default:
                console.warn("Unknown action for quick study:", action);
        }
    }

    function createTop100List() {
        let top100flashcards = browserdata.saved
            .filter(set => set.data && Array.isArray(set.data))
            .flatMap(set => set.data.map(flashcard => ({ ...flashcard, setId: set.setId })))
            .sort((a, b) => (b.rating || 0) - (a.rating || 0)) // Sort by correct answers
            .slice(0, 100); // Limit to top 100
        if (top100flashcards.length === 0) {
            showToast("No flashcards available for Top 100.", "info");
            return;
        }
        // Create a new set with the top 100 flashcards
        const newSet = {
            name: "Top 100 Flashcards",
            data: top100flashcards,
            setId: 'top100_' + Date.now(), // Generate a unique ID
            ownerName: "Flow"
        };
        // Save the new set to browserdata
        browserdata.saved.push(newSet);
        saveBrowserAndAccountData(browserdata, account_data); // Save to localStorage
        // Redirect to the Preview page with the new set
        trackSessionTime(); // Track time before navigating
        safeReplace(`Flow/Preview/?setId=${newSet.setId}`);
    }

    function switchTab(tabId) {
        if (!tabId) return;
        // Update button states
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId));
        // Update content visibility
        tabContents.forEach(content => content.classList.toggle('active', content.id === `${tabId}-content`));
    }

    // --- Utility ---
    function trackSessionTime() {
        if (!sessionStartTime) return;
        addToStreakToday(browserdata, sessionStartTime); // from utils.js
        saveBrowserAndAccountData(browserdata, account_data); // from utils.js
        renderStreak(); // Update UI immediately
        console.log("Session time tracked and saved.");
        sessionStartTime = Date.now(); // Reset start time for next interaction period
    }


    // --- Start the application ---
    init();
});