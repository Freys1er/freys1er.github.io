// --- Configuration ---
const API_URL = "https://script.google.com/macros/s/AKfycbx-Nr3MrPU1YHYxpFEUWL5VSRKDKR4Vgq5pVIpUJKowsiY3fiugJ942SryUhZ-W4DY9gQ/exec"; // !!! REPLACE WITH YOUR DEPLOYED URL !!!
const GOOGLE_CLIENT_ID = "490934668566-dpcfvk9p5kfpk44ko8v1gl3d5i9f83qr.apps.googleusercontent.com"; // !!! REPLACE WITH YOUR CLIENT ID !!!

// --- State ---

const SESSION_DURATION_MS = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

let currentUser = null; // { userID, name, email, picture, idToken }
let currentProfileData = null; // Store data for the currently viewed profile
let currentVotesSort = 'recent'; // Default sort for profile votes

// --- DOM Elements ---
const loginSection = document.getElementById('login-section');
const homeSection = document.getElementById('home-section');
const profileSection = document.getElementById('profile-section');
const authStatusDiv = document.getElementById('auth-status');
const userListUl = document.getElementById('user-list');
const userListContainer = document.getElementById('user-list-container');
const profileInfoDiv = document.getElementById('profile-info');
const votesListUl = document.getElementById('votes-list');
const votesListContainer = document.getElementById('votes-list-container');
const voteActionContainer = document.getElementById('vote-action-container');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const backToHomeButton = document.getElementById('back-to-home');
const sortVotesSelect = document.getElementById('sort-votes-select');
const errorMessageDiv = document.getElementById('error-message');

// --- Initialization ---
window.onload = () => {
    loadSession();
    // Check if returning from Google Sign-In redirect (though we use callback)
    // Initialize Google Sign In (redundant with div attributes, but good practice)
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    });

    // Check for profile ID in URL on load
    handleRouting();

    // Add event listeners
    searchButton.addEventListener('click', () => fetchAndRenderUsers(searchInput.value));
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchAndRenderUsers(searchInput.value);
    });
    backToHomeButton.addEventListener('click', navigateToHome);
    sortVotesSelect.addEventListener('change', () => {
        currentVotesSort = sortVotesSelect.value;
        if (currentProfileData) {
            renderVotesList(currentProfileData.votes); // Re-render with new sort
        }
    });
};

function saveSession(userData, idToken) {
    const expiry = Date.now() + SESSION_DURATION_MS;
    const sessionData = {
        token: idToken,
        userId: userData.userID,
        name: userData.name,
        picture: userData.picture,
        email: userData.email, // Store email too if needed
        expiry: expiry
    };
    try {
        localStorage.setItem('userSession', JSON.stringify(sessionData));
        console.log("Session saved to localStorage.");
    } catch (e) {
        console.error("Error saving session to localStorage:", e);
        // Handle potential storage quota exceeded errors
    }
}

function loadSession() {
    try {
        const storedSession = localStorage.getItem('userSession');
        if (storedSession) {
            const sessionData = JSON.parse(storedSession);
            // Check if expired
            if (sessionData.expiry && sessionData.expiry > Date.now()) {
                // Session is valid, load into currentUser
                currentUser = {
                    userID: sessionData.userId,
                    name: sessionData.name,
                    picture: sessionData.picture,
                    email: sessionData.email,
                    idToken: sessionData.token // Crucial: restore the token
                };
                console.log("Session loaded from localStorage:", currentUser.name);
            } else {
                // Session expired, clear it
                console.log("Stored session expired.");
                clearSession();
            }
        }
    } catch (e) {
        console.error("Error loading session from localStorage:", e);
        clearSession(); // Clear potentially corrupted data
    }
}


function clearSession() {
    localStorage.removeItem('userSession');
    currentUser = null; // Clear in-memory state too
    console.log("Session cleared from localStorage.");
}



// --- Routing & Page Navigation ---

function handleRouting() {
    console.log("handleRouting called. currentUser:", currentUser ? currentUser.name : 'None'); // Debug log
    const params = new URLSearchParams(window.location.search);
    const targetUserID = params.get('userID');

    clearError(); // Clear errors on navigation

    if (targetUserID) {
        // If a userID is specified, try to show the profile page
        if (currentUser) {
            showPage('profile');
            fetchAndRenderProfile(targetUserID);
        } else {
            console.log("Profile requested but user not logged in, showing login.");
            // Need to login first. Store intended destination? (More complex)
            // For now, just show login. The user must log in then navigate again.
            const url = new URL(window.location);
            url.searchParams.delete('userID'); // Clear param if showing login
            window.history.replaceState({}, '', url.pathname + url.search); // Use replaceState to avoid messy history
            showPage('login');
            renderLoginState();
        }
    } else {
        // No userID, show home if logged in, else login
        if (currentUser) {
            console.log("Routing to HOME");
            showPage('home');
            fetchAndRenderUsers(); // Is this getting called?
        } else {
            console.log("Routing to LOGIN");
            showPage('login');
            renderLoginState();
        }
    }
}

function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.style.display = 'none';
    });
    const page = document.getElementById(`${pageId}-section`);
    if (page) {
        page.style.display = 'block';
    } else {
        console.error("Page not found:", pageId);
        showPage('login'); // Fallback
    }
    // Update browser history/URL without reload for profile pages
    const url = new URL(window.location);
    if (pageId === 'profile') {
        // URL should already contain userID if called correctly
    } else {
        url.searchParams.delete('userID');
        window.history.pushState({}, '', url.pathname + url.search); // Update URL for home/login
    }

}


function navigateToHome() {
    clearError();
    // Clear the userID parameter from the URL
    const url = new URL(window.location);
    url.searchParams.delete('userID');
    window.history.pushState({}, '', url.pathname + url.search); // Update URL
    showPage('home');
    fetchAndRenderUsers(); // Refresh user list
}

function navigateToProfile(userID) {
    clearError();
    const url = new URL(window.location);
    url.searchParams.set('userID', userID);
    window.history.pushState({}, '', url.pathname + url.search); // Update URL
    showPage('profile');
    fetchAndRenderProfile(userID);
}


// --- Authentication ---
let loadingIndicator = null; // Keep track of loading message element

function showLoadingMessage(message = "Loading...") {
    clearError(); // Hide error messages when loading starts
    if (!loadingIndicator) {
        loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading-message';
        loadingIndicator.className = 'loading'; // Use existing loading style
        loadingIndicator.style.position = 'fixed'; // Make it overlay
        loadingIndicator.style.top = '10px';
        loadingIndicator.style.right = '10px';
        loadingIndicator.style.backgroundColor = 'rgba(0,0,0,0.7)';
        loadingIndicator.style.color = 'white';
        loadingIndicator.style.padding = '10px 15px';
        loadingIndicator.style.borderRadius = '5px';
        loadingIndicator.style.zIndex = '1000';
        document.body.appendChild(loadingIndicator);
    }
    loadingIndicator.textContent = message;
    loadingIndicator.style.display = 'block';
}

function hideLoadingMessage() {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

function handleCredentialResponse(response) {
    console.log("Google Sign-In Response Received:", response);
    const idToken = response.credential;
    if (!idToken) {
        console.error("No idToken received from Google!");
        showError("Login failed: No token received from Google.");
        return;
    }
    console.log("Extracted idToken:", idToken.substring(0, 30) + "...");

    // Add a loading indicator maybe?
    showLoadingMessage("Verifying login...");

    makeApiCall('login', { idToken: idToken })
        .then(result => {
            hideLoadingMessage();
            console.log("API Call 'login' Succeeded:", result);
            // IMPORTANT: Use the data RETURNED from the API for consistency
            currentUser = { ...result.data, idToken: idToken };
            saveSession(result.data, idToken); // Save the session with expiry
            console.log("Current User Set & Session Saved:", currentUser.name);
            renderLoginState();
            handleRouting(); // Re-route based on login state
        })
        .catch(error => {
            hideLoadingMessage();
            console.error("API Call 'login' FAILED:", error);
            showError(`Login failed: ${error.message}`);
            clearSession(); // Ensure no partial session is stored
            renderLoginState(); // Show login button again
        });
}

function handleLogout() {
    // Optional: Explicitly revoke token on Google's side (more involved)
    // google.accounts.id.revoke(currentUser.email || '', done => {
    //    console.log('Google token revoked.');
    // });

    google.accounts.id.disableAutoSelect(); // Prevent auto-login next time
    clearSession(); // Clear local storage and currentUser variable
    console.log("User logged out.");
    renderLoginState();
    // Force back to login page
    const url = new URL(window.location);
    url.searchParams.delete('userID');
    window.history.pushState({}, '', url.pathname + url.search);
    showPage('login');
}

function handleLogout() {
    currentUser = null;
    google.accounts.id.disableAutoSelect(); // Prevent auto-login next time
    console.log("User logged out.");
    renderLoginState();
    // Clear sensitive data if necessary
    currentProfileData = null;
    // Force back to login page
    const url = new URL(window.location);
    url.searchParams.delete('userID');
    window.history.pushState({}, '', url.pathname + url.search);
    showPage('login');
}



function renderLoginState() {
    authStatusDiv.innerHTML = ''; // Clear previous state
    if (currentUser) {
        // User is logged in (from loadSession or handleCredentialResponse)
        const welcomeSpan = document.createElement('span');
        welcomeSpan.textContent = `Welcome, ${currentUser.name} `;
        welcomeSpan.style.marginRight = '10px';

        const logoutButton = document.createElement('button');
        logoutButton.textContent = `Logout`;
        logoutButton.onclick = handleLogout;

        authStatusDiv.appendChild(welcomeSpan);
        authStatusDiv.appendChild(logoutButton);
    } else {
        // Render the Google Sign-In button if it's not already there or if needed
        // The HTML div structure should handle initial rendering
        // We might need to explicitly call renderButton if the user logs out and needs to log back in
        google.accounts.id.renderButton(
            document.getElementById("auth-status"), // Or render inside the login section if preferred
            { theme: "filled_black", size: "medium", text: "signin_with" } // Customize button
        );
    }
}

// --- API Interaction ---

async function makeApiCall(action, params = {}) {
    console.log("Making API call...")
    console.log(action, params);
    if (!API_URL) {
        throw new Error("API_URL is not configured in script.js");
    }
    if (!action) {
        throw new Error("API action is required.");
    }

    // Include idToken for authenticated requests
    if (currentUser && currentUser.idToken && action !== 'login') { // Don't send token again for login itself
        params.idToken = currentUser.idToken;
    }

    // Construct URL with query parameters (GET request)
    const url = new URL(API_URL);
    url.searchParams.append('action', action);
    for (const key in params) {
        if (params[key] !== undefined && params[key] !== null) {
            // Ensure values that might contain special characters are encoded
            url.searchParams.append(key, encodeURIComponent(params[key]));
        }
    }

    console.log("Making API Call:", url.toString()); // Log the URL being called (useful for debugging, remove sensitive parts in production logs)


    try {
        const response = await fetch(url.toString(), { // Use the string representation
            method: 'GET',
            // Headers might be needed for CORS depending on deployment, but GET usually simpler
            redirect: 'follow' // Follow redirects if Apps Script returns one
        });

        // Check if the response is JSON
        const contentType = response.headers.get("content-type");
        if (!response.ok) {
            let errorText = `HTTP error! status: ${response.status}`;
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const errorJson = await response.json();
                errorText = `API Error: ${errorJson.message || response.statusText}`;
                throw new Error(errorText); // Throw error with message from JSON if available
            } else {
                errorText = await response.text(); // Get text for non-JSON errors
                throw new Error(`HTTP error ${response.status}: ${errorText}`);
            }
        }

        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            if (data.status === 'error') {
                throw new Error(data.message || 'Unknown API error');
            }
            return data; // Should contain { status: 'success', data: ... }
        } else {
            // Handle non-JSON responses if necessary, perhaps HTML from Apps Script error page?
            const textData = await response.text();
            console.warn("Received non-JSON response:", textData);
            // Attempt to parse anyway, might be an Apps Script HTML error page
            if (textData.toLowerCase().includes("script function not found")) {
                throw new Error("API endpoint misconfiguration (Script function not found). Check deployment.");
            }
            throw new Error("Received non-JSON response from API.");
        }

    } catch (error) {
        console.error('API Call Failed:', error);
        showError(`Network or API Error: ${error.message}`); // Display user-friendly error
        throw error; // Re-throw for caller to handle if needed
    }
}

// --- Data Fetching and Rendering ---

function fetchAndRenderUsers(searchTerm = '') {
    if (!currentUser) {
        console.error("Attempted fetchAndRenderUsers while not logged in.");
        // Optionally redirect to login or show error
        navigateToHome(); // This will route to login if not logged in
        return;
    }

    userListContainer.innerHTML = `<p class="loading">Loading users...</p>`;
    makeApiCall('getUsers', { searchTerm: searchTerm /*, sortBy: 'trending' */ })
        .then(result => {
            renderUserList(result.data);
        })
        .catch(error => {
            userListContainer.innerHTML = `<p class="error">Failed to load users: ${error.message}</p>`;
        });
}

function renderUserList(users) {
    userListUl.innerHTML = ''; // Clear previous list
    if (!users || users.length === 0) {
        userListContainer.innerHTML = '<p>No users found.</p>';
        return;
    }

    users.forEach(user => {
        const li = document.createElement('li');

        const link = document.createElement('a');
        link.href = `?userID=${user.userID}`; // Link to profile page
        link.textContent = user.name;
        link.onclick = (e) => {
            e.preventDefault(); // Prevent full page reload
            navigateToProfile(user.userID);
        };

        li.appendChild(link);
        userListUl.appendChild(li);
    });
    userListContainer.innerHTML = ''; // Clear loading message
    userListContainer.appendChild(userListUl); // Add the populated list
}


function fetchAndRenderProfile(targetUserID) {
    if (!currentUser) return;

    profileInfoDiv.innerHTML = `<p class="loading">Loading profile...</p>`;
    votesListContainer.innerHTML = `<p class="loading">Loading votes...</p>`;
    voteActionContainer.innerHTML = ''; // Clear previous vote form/button

    makeApiCall('getUserProfile', { targetUserID: targetUserID })
        .then(result => {
            currentProfileData = result.data; // Store profile data
            renderProfileInfo(currentProfileData.profile);
            renderVotesList(currentProfileData.votes);
            renderVoteAction(targetUserID, currentProfileData.currentUserVote);
        })
        .catch(error => {
            profileInfoDiv.innerHTML = `<p class="error">Failed to load profile: ${error.message}</p>`;
            votesListContainer.innerHTML = '';
            voteActionContainer.innerHTML = '';
        });
}


function renderProfileInfo(profile) {
    profileInfoDiv.innerHTML = `
        <img src="${profile.picture || 'default-avatar.png'}" alt="${profile.name}'s profile picture">
        <div class="profile-details">
            <h2>${profile.name}</h2>
            <p>Reputation Score:</p>
        </div>
        <div class="profile-score score-display ${getScoreColorClass(profile.averageScore)}">
             ${profile.displayScore}
        </div>
    `;
    // Add email or other details if desired
    // const emailP = document.createElement('p');
    // emailP.textContent = `Email: ${profile.email}`; // Maybe hide email for privacy?
    // profileInfoDiv.querySelector('.profile-details').appendChild(emailP);
}


function renderVotesList(votes) {
    votesListUl.innerHTML = ''; // Clear previous list

    // Sort votes based on current selection
    const sortedVotes = [...votes].sort((a, b) => {
        if (currentVotesSort === 'trending') {
            return (b.likes || 0) - (a.likes || 0); // Higher likes first
        } else { // Default to 'recent'
            // Assuming timestamp is a string that can be compared; convert to Date if needed
            return new Date(b.timestamp) - new Date(a.timestamp); // Newer first
        }
    });


    if (!sortedVotes || sortedVotes.length === 0) {
        votesListContainer.innerHTML = '<p>No votes received yet.</p>';
        return;
    }

    sortedVotes.forEach(vote => {
        const li = document.createElement('li');
        const voteDate = vote.timestamp ? new Date(vote.timestamp).toLocaleString() : 'Unknown date';

        li.innerHTML = `
            <div class="vote-header">
                <img src="${vote.voterPicture || 'default-avatar.png'}" alt="${vote.voterName}'s picture">
                <strong>${vote.voterName || 'Unknown Voter'}</strong>
                <span class="vote-score score-display ${getScoreColorClass(vote.score)}">${vote.score}/5</span>
                 <span class="vote-timestamp">${voteDate}</span>
            </div>
            ${vote.comment ? `<div class="vote-comment">${escapeHtml(vote.comment)}</div>` : ''}
            <div class="vote-actions">
                 <button class="like-button" data-voteid="${vote.voteID}">
                     👍 Like <span class="likes-count">${vote.likes || 0}</span>
                 </button>
             </div>
        `;

        // Add event listener for the like button
        const likeButton = li.querySelector('.like-button');
        if (likeButton) {
            likeButton.onclick = () => handleLikeVote(vote.voteID, likeButton);
        }

        votesListUl.appendChild(li);
    });
    votesListContainer.innerHTML = ''; // Clear loading
    votesListContainer.appendChild(votesListUl); // Add list
}

function renderVoteAction(targetUserID, currentUserVote) {
    voteActionContainer.innerHTML = ''; // Clear previous

    // Prevent voting for self
    if (currentUser && currentUser.userID === targetUserID) {
        voteActionContainer.innerHTML = "<p>You cannot vote for yourself.</p>";
        return;
    }

    const isUpdate = currentUserVote !== null;
    const buttonText = isUpdate ? 'Update Your Vote' : 'Submit Your Vote';
    const legendText = isUpdate ? 'Update Your Rating & Comment' : 'Rate This User';

    const form = document.createElement('form');
    form.id = 'vote-form';
    form.onsubmit = (e) => {
        e.preventDefault();
        handleVoteSubmit(targetUserID);
    };

    let scoreHtml = '';
    for (let i = 0; i <= 5; i++) {
        const isChecked = isUpdate && currentUserVote.score === i;
        scoreHtml += `
            <label>
                <input type="radio" name="score" value="${i}" ${isChecked ? 'checked' : ''} required> ${i}
            </label>
        `;
    }

    form.innerHTML = `
        <fieldset>
            <legend>${legendText}</legend>
            <label>Score (0-5):</label>
            <div class="score-selector">
                ${scoreHtml}
            </div>
            <label for="comment">Comment (optional):</label>
            <textarea id="comment" name="comment">${isUpdate ? escapeHtml(currentUserVote.comment || '') : ''}</textarea>
            <button type="submit">${buttonText}</button>
        </fieldset>
    `;

    voteActionContainer.appendChild(form);
}

// --- Event Handlers ---

function handleVoteSubmit(targetUserID) {
    if (!currentUser) {
        showError("You must be logged in to vote.");
        return;
    }

    const form = document.getElementById('vote-form');
    const selectedScore = form.querySelector('input[name="score"]:checked');
    const comment = form.querySelector('#comment').value;

    if (!selectedScore) {
        showError("Please select a score between 0 and 5.");
        return;
    }

    const score = parseInt(selectedScore.value, 10);

    clearError();
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.textContent = 'Submitting...';
    submitButton.disabled = true;


    makeApiCall('submitVote', {
        targetUserID: targetUserID,
        score: score,
        comment: comment
    })
        .then(result => {
            console.log("Vote submission result:", result);
            showSuccess("Vote submitted successfully!"); // Provide user feedback
            // Refresh the profile to show the updated vote/score
            fetchAndRenderProfile(targetUserID);
            // No need to manually re-enable button, fetchAndRenderProfile clears the container
        })
        .catch(error => {
            showError(`Failed to submit vote: ${error.message}`);
            submitButton.textContent = currentUserVote ? 'Update Your Vote' : 'Submit Your Vote'; // Restore text
            submitButton.disabled = false; // Re-enable button on error
        });
}

function handleLikeVote(voteID, buttonElement) {
    if (!currentUser) {
        showError("You must be logged in to like votes.");
        return;
    }
    clearError();
    buttonElement.disabled = true; // Prevent double-clicking

    makeApiCall('likeVote', { voteID: voteID })
        .then(result => {
            console.log("Like result:", result);
            // Update the like count directly in the UI
            const countSpan = buttonElement.querySelector('.likes-count');
            if (countSpan && result.data && result.data.newLikes !== undefined) {
                countSpan.textContent = result.data.newLikes;
            }
            // Optionally show a success message, though updating the count might be enough
            // showSuccess("Liked!"); // Can be annoying if liking many things
            buttonElement.disabled = false; // Re-enable after success
        })
        .catch(error => {
            showError(`Failed to like vote: ${error.message}`);
            buttonElement.disabled = false; // Re-enable on error
        });
}


// --- Utility Functions ---

function getScoreColorClass(score) {
    const roundedScore = Math.round(score); // Use the raw 0-5 score for coloring
    if (roundedScore <= 0) return 'score-0';
    if (roundedScore === 1) return 'score-1';
    if (roundedScore === 2) return 'score-2';
    if (roundedScore === 3) return 'score-3';
    if (roundedScore === 4) return 'score-4';
    if (roundedScore >= 5) return 'score-5';
    return ''; // Default or fallback
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe
        .toString()
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, '"')
        .replace(/'/g, "'");
}

function showError(message) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.style.display = 'block';
    // Automatically hide after a few seconds
    setTimeout(clearError, 5000);
}

function showSuccess(message) {
    // Could implement a temporary success message bar if needed
    console.log("Success:", message); // Simple console log for now
}


function clearError() {
    errorMessageDiv.textContent = '';
    errorMessageDiv.style.display = 'none';
}