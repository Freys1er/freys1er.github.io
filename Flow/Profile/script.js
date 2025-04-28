// Profile/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let browserdata = {};
    let account_data = null; // Logged-in user's data
    let profileUserId = null; // ID of the profile being viewed
    let profileData = null; // Data for the profile being viewed

    // --- DOM Elements ---
    const loadingOverlay = document.getElementById('loading-overlay');
    const usernameEl = document.getElementById('profile-username');
    const memberSinceEl = document.getElementById('profile-member-since');
    const backButton = document.getElementById('profile-back-btn');
    const tabButtons = document.querySelectorAll('.secondary-nav .tab-button');
    const tabContents = document.querySelectorAll('.tab-content .tab-content-section');

    // Content Placeholders
    const ownedCountEl = document.getElementById('owned-count');
    const ownedListEl = document.getElementById('owned-sets-list');
    const editableCountEl = document.getElementById('editable-count');
    const editableListEl = document.getElementById('editable-sets-list');

    // Account Details Placeholders
    const usernameEditEl = document.getElementById('username-item');
    const detailUsernameEl = document.getElementById('username-input');
    const detailUsernameTextEl = document.getElementById('detail-username');
    const detailUserIdEl = document.getElementById('detail-user-id'); // Added
    const detailCreatedEl = document.getElementById('detail-created-date');
    const detailLikesEl = document.getElementById('detail-total-likes');
    const detailSubEl = document.getElementById('detail-subscription');
    const detailSubExpiryEl = document.getElementById('detail-subscription-expiry');
    const subExpiryItemEl = document.getElementById('sub-expiry-item');
    const logoutButton = document.getElementById('logout-button');
    const profilePicEl = document.getElementById('profile-pic');
    const saveButton = document.getElementById('save-button'); // Added for future use
    const redeemButton = document.getElementById('redeem-button'); // Added for future use
    const redeemCodeError = document.getElementById('redeem-code-error'); // Added for future use
    const redeemCodeArea = document.getElementById('redeem-code'); // Added for future use
    const redeemCodeInput = document.getElementById('redeem-code-input'); // Added for future use

    const likeButtons = document.querySelectorAll('.set-likes'); // Get all elements with the class



    // --- Initialization ---
    function init() {
        showLoading();
        const loadedData = loadBrowserAndAccountData(); // from utils.js
        browserdata = loadedData.browserdata;
        account_data = loadedData.account_data;

        const urlParams = new URLSearchParams(window.location.search);
        profileUserId = urlParams.get('userId');

        setupEventListeners();

        // Determine whose profile to load
        if (!profileUserId) {
            // If no ID in URL, try to load logged-in user's profile
            if (account_data && (account_data.serverInfo?.userId || account_data.userInfo?.sub)) {
                profileUserId = account_data.serverInfo?.userId || account_data.userInfo?.sub;
                console.log("No userId in URL, loading logged-in user's profile:", profileUserId);
                fetchProfileData(profileUserId);
            } else {
                showError("User ID not specified and user not logged in.");
                safeReplace("Google/?redirect=Flow/Profile");
            }
        } else {
            // Load profile for the userId specified in the URL
            console.log("Loading profile for userId from URL:", profileUserId);
            fetchProfileData(profileUserId);
        }
    }

    function showLoading(message = "Loading Profile...") {
        if (loadingOverlay) {
            loadingOverlay.querySelector('p').textContent = message;
            loadingOverlay.classList.add('visible');
        }
    }
    function hideLoading() {
        if (loadingOverlay) loadingOverlay.classList.remove('visible');
    }
    function showError(message) {
        console.error(message);
        showToast(message, 'error'); // from utils.js
        hideLoading();
        // Update UI to show error
        if (usernameEl) usernameEl.textContent = "Error";
        if (memberSinceEl) memberSinceEl.textContent = message;
        // Clear content areas
        ownedListEl.innerHTML = '<li>Error loading data.</li>';
        editableListEl.innerHTML = '<li>Error loading data.</li>';
        // Clear account details?
    }

    // --- Data Fetching ---
    async function fetchProfileData(userId) {
        if (!userId) {
            showError("Cannot fetch profile: User ID is missing.");
            return;
        }
        // Check if we need the logged-in user's token (e.g., for fetching editable sets for *another* user)
        if (!account_data || !account_data.token) {
            // If viewing someone else's profile might require login for certain data (like editable sets)
            // For now, assume public profile data doesn't strictly require login,
            // but editable sets might be empty if not logged in as the viewer.
            console.warn("Not logged in, some profile data might be unavailable.");
            // Allow fetch attempt anyway for public data.
        }

        showLoading(`Loading profile`);
        try {
            // Use a dedicated server action like "getUserProfile"
            // Pass the target userId and potentially the logged-in user's token (if needed for permissions)
            const result = await doGet(account_data?.token, "getUserData", { targetUser: userId });

            console.log("Profile data received:", result);

            if (!result || !result.profileData) { // Expecting data nested in profileData
                throw new Error("Invalid profile data received from server.");
            }
            profileData = result.profileData; // Store fetched data

            // Process and Render
            renderProfile(profileData);
            hideLoading();

        } catch (error) {
            console.error("Failed to fetch profile data:", error);
            showError(`Failed to load profile: ${error.message}`);
            // Redirect home?
            setTimeout(() => { safeReplace("Flow") }, 300000);
        }
    }


    // --- Rendering ---
    function renderProfile(data) {
        if (!data) {
            showError("Cannot render profile: Invalid data.");
            return;
        }

        // Header Info
        const userName = data.username || 'Unknown User';
        usernameEl.textContent = userName;
        memberSinceEl.textContent = `Member since: ${data.created ? formatDate(data.created) : 'Unknown'}`; // Use utils.js

        // Load profile picture if available
        if (data.picture) {
            profilePicEl.src = data.picture;
        } else {
            profilePicEl.src = "../../icons/account.svg"; // Fallback if no picture in data
        }

        const isOwnProfile = account_data?.userInfo?.sub === data?.userId;

        // Owned Sets Tab
        ownedListEl.innerHTML = ''; // Clear loading/previous state
        const ownedSets = data.Owners || data.ownedSets || []; // Allow different key names
        if (ownedSets.length > 0) {
            ownedCountEl.textContent = ownedSets.length;
            ownedSets.forEach(set => {
                const li = createSetItemForProfile(set, true); // true indicates owned set
                ownedListEl.appendChild(li);
            });
        } else {
            ownedCountEl.textContent = 0;
            ownedListEl.innerHTML = '<li>No sets owned by this user.</li>';
        }

        // Editable Sets Tab
        editableListEl.innerHTML = ''; // Clear loading/previous state
        const editableSets = data.Editors || data.editableSets || []; // Allow different key names
        // Filter editable sets if viewing someone else's profile and not logged in?
        // For now, display whatever the server returns.
        if (editableSets.length > 0) {
            editableCountEl.textContent = editableSets.length;
            editableSets.forEach(set => {
                const li = createSetItemForProfile(set, false); // false indicates editable set
                editableListEl.appendChild(li);
            });
        } else {
            editableCountEl.textContent = 0;
            editableListEl.innerHTML = '<li>No sets being edited by this user.</li>';
        }

        // Account Details Tab
        detailUsernameEl.value = userName;
        detailUsernameTextEl.textContent = userName; // Show text version for non-editing mode
        detailUsernameEl.placeholder = 'Enter new username...'; // Placeholder for input
        detailUserIdEl.textContent = data.userId || data.googleId || 'N/A'; // Display the primary ID
        detailCreatedEl.textContent = data.created ? formatDate(data.created) : 'N/A'; // Use utils.js
        detailLikesEl.textContent = data.totalLikes !== undefined ? data.totalLikes : 'N/A';
        detailSubEl.textContent = data.subscription || 'Free'; // Default to Free

        if (data.subscription && data.subscription !== 'Free' && data.subscriptionExpiry) {
            detailSubExpiryEl.textContent = formatDate(data.subscriptionExpiry); // Use utils.js
            subExpiryItemEl.style.display = 'flex'; // Show expiry item (use flex like others)
        } else {
            subExpiryItemEl.style.display = 'none'; // Hide expiry item
        }

        console.log(isOwnProfile);

        // Show/Hide logout button based on whether it's the user's own profile
        logoutButton.style.display = isOwnProfile ? 'block' : 'none';
        saveButton.style.display = isOwnProfile ? 'block' : 'none';
        redeemButton.style.display = isOwnProfile ? 'block' : 'none';
        redeemCodeArea.style.display = isOwnProfile ? 'flex' : 'none';
        usernameEditEl.style.display = isOwnProfile ? 'flex' : 'none'; // Show input only for own profile
        detailUsernameTextEl.style.display = isOwnProfile ? 'none' : 'flex'; // Hide text only for own profile

        // Set default tab
        switchTab('owned');
    }

    /** Creates a list item for a set on the profile page */
    function createSetItemForProfile(set, isOwner) {
        const li = document.createElement('li');
        li.className = 'set-item'; // Use common styling
        li.dataset.setId = set.setId; // Store set ID

        // Details text differs if owner or editor
        const detailsText = isOwner
            ? `Last modified: ${set.modified ? formatDate(set.modified) : 'Unknown'}`
            : `Owned by: ${set.ownerName || 'Unknown'} | Modified: ${set.modified ? formatDate(set.modified) : 'Unknown'}`;

        li.innerHTML = `
            <div class="set-details">
                <span class="set-name">${set.setName || set.name || 'Unnamed Set'}</span>
                <span class="set-sub-details">${detailsText}</span>
            </div>
            <span class="set-likes">${set.likes !== undefined ? set.likes : '0'}</span>
        `;

        // Add click listener to navigate to the Preview page for this set
        li.addEventListener('click', (event) => { // Note the 'event' parameter here
            if (!event.target.classList.contains('set-likes') && !event.target.closest('.set-likes')) {
                const setId = li.dataset.setId;

                if (setId) {
                    safeReplace(`Flow/Preview/?setId=${setId}`);
                } else {
                    showToast("Error: Set ID is missing.", "error");
                }
            } else {
                //if liked already, unlike it
                if (set.liked) {
                    set.liked = false; // Update the liked status
                    li.querySelector('.set-likes').textContent = set.likes; // Decrease likes count
                    showToast("Unliked set: " + set.setId, "success"); // Show success message
                } else {
                    set.liked = true; // Update the liked status
                    li.querySelector('.set-likes').textContent = set.likes + 1; // Increase likes count
                    showToast("Liked set: " + set.setId, "success"); // Show success message
                }
                doGet(account_data?.token, "likeSet", {
                    setId: set.setId
                }).then((result) => {
                    console.log("Set like changed successfully:", result);
                    if (result.liked) {
                        li.querySelector('.set-likes').textContent = set.likes + 1; // Increase likes count
                    } else {
                        li.querySelector('.set-likes').textContent = set.likes - 1; // Decrease likes count
                    }
                }).catch(error => {
                    console.error("Error changing like for set:", error);
                    showToast("Failed to like/unlike set. Please try again.", "error");
                })
            }
        });
        return li;
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        if (backButton) {
            backButton.addEventListener('click', () => {
                // Go back in history, or default to home page
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    safeReplace("Flow"); // Redirect to home
                }
            });
        }

        // Tab Switching Logic
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                switchTab(button.getAttribute('data-tab'));
            });
        });

        // Logout Button
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }

        // Save Button (for future use)
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                showToast("Saving profile...", "info");
                doGet(account_data?.token, "updateUser", {
                    username: detailUsernameEl.value.trim()
                }).then(() => {
                    // Update the displayed username
                    detailUsernameTextEl.textContent = detailUsernameEl.value.trim();
                    detailUsernameEl.value = ''; // Clear input field
                    showToast("Profile updated successfully!", "success");
                }).catch(error => {
                    console.error("Error updating profile:", error);
                    showToast("Failed to update profile. Please try again.", "error");
                });
            });
        }
        // Redeem Button (for future use)
        if (redeemButton) {
            redeemButton.addEventListener('click', () => {
                const code = redeemCodeInput.value.trim();
                if (code) {
                    showToast(`Redeeming code: ${code}`, "info");
                    redeemCode(code); // Placeholder for redeem function
                } else {
                    showToast("Please enter a valid code.", "error");

                    redeemCodeError.textContent = "Please enter a valid code."; // Show error message
                    redeemCodeError.style.display = "block"; // Show error message

                }
            });
        }

    }

    // --- Redeem Code Function (Placeholder) ---
    async function redeemCode(code) {
        try {
            const result = await doGet(account_data?.token, "redeemGiftCard", { giftCardId: code });
            if (result.status === 'success') {
                showToast("Code redeemed successfully!", "success");
                // Optionally refresh profile data or update UI
            } else {
                showToast(`Failed to redeem code: ${result.error}`, "error");

                redeemCodeError.textContent = `Failed to redeem code: ${result.error}`; // Show error message
                redeemCodeError.style.display = "block"; // Show error message
            }
        } catch (error) {
            console.error("Error redeeming code:", error);
            showToast("Error redeeming code. Please try again later.", "error");

            redeemCodeError.textContent = "Error redeeming code. Please try again later."; // Show error message
            redeemCodeError.style.display = "block"; // Show error message
        }
    }

    // --- Tab Switching ---
    function switchTab(tabId) {
        if (!tabId) return;
        // Update button states
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId));
        // Update content visibility
        tabContents.forEach(content => content.classList.toggle('active', content.id === `${tabId}-content`));
    }

    // --- Actions ---
    function handleLogout() {
        showToast("Logging out...", "info");
        // Clear local storage related to account
        localStorage.removeItem('account_data');
        // Optionally clear parts of browserdata if needed
        // browserdata.saved = []; // Example: clear saved sets on logout? Decide based on UX.
        // saveBrowserAndAccountData(browserdata, null);

        // Redirect to home page or login page after a short delay
        setTimeout(() => {
            safeReplace('Flow'); // Redirect to home
        }, 1500);
    }

    // --- Start ---
    init();
});