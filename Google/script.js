// --- Existing Helper Functions (keep these) ---

function parseJwt(token) {
    // ... (keep your existing function)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

async function server(token, action, data = "") {
    // ... (keep your existing function)
    const API_URL = "https://script.google.com/macros/s/AKfycbz1MPkZ0g0JjExBxpLZkzBOWqJ4-P1kHvFl3SaUf7zNJlNSEvs_DAy1QgCr-yrrtyrD/exec"; // Replace with your actual deployment URL

    const payload = {
        action: action,
        data: data
    };

    const queryParams = new URLSearchParams({
        token: token,
        payload: JSON.stringify(payload)
    });

    try {
        const response = await fetch(`${API_URL}?${queryParams.toString()}`);
        if (!response.ok) {
            // Try to get error details from the response body if possible
            let errorBody = 'No details available.';
            try {
                errorBody = await response.text(); // or response.json() if the server sends JSON errors
            } catch (e) { /* ignore parsing error */ }
            throw new Error(`HTTP error! Status: ${response.status}. Body: ${errorBody}`);
        }
        const result = await response.json();
        console.log("Server Response:", result);
        return result;
    } catch (error) {
        console.error("Error communicating with the server:", error.message);
        // Rethrow the error so it can be caught by the caller
        throw error;
    }
}

function safeReplace(newDir) {
    // ... (keep your existing function)
    const parsedURL = new URL(window.location.href);
    let baseURL = `${parsedURL.protocol}//${parsedURL.hostname}`;
    if (parsedURL.port) baseURL += `:${parsedURL.port}`;
    const hivePath = "/Hive"; // Assuming your app might be in a subfolder
    const hiveIndex = parsedURL.pathname.indexOf(hivePath);
    if (hiveIndex !== -1) {
        baseURL += parsedURL.pathname.slice(0, hiveIndex + hivePath.length);
    }
    const newUrl = `${baseURL}/${newDir.startsWith('/') ? newDir.substring(1) : newDir}`; // Ensure single slash
    if (window.location.href !== newUrl) {
        console.log("Redirecting to:", newUrl);
        window.location.href = newUrl; // Use href for navigation
    } else {
        console.log("Already at the target URL or target is empty, not redirecting:", newUrl);
        // Optionally reload if newDir is empty and already there: window.location.reload();
    }
}


const loadingMessages = [
    "Hang tight! We're fetching your data...",
    "Just a moment, we're getting everything ready for you...",
    "Loading your personalized experience...",
    "Please wait while we prepare your dashboard...",
    "We're almost there! Gathering your information...",
    "Connecting to the Hive Mind...",
    "Validating credentials...",
    "Setting up your session..."
];
function getRandomLoadingMessage() {
    const randomIndex = Math.floor(Math.random() * loadingMessages.length);
    return loadingMessages[randomIndex];
}

// Global variable to hold the loader element
let loaderElement = null;

function showLoadingScreen(message = getRandomLoadingMessage()) {
    if (loaderElement) { // Update message if already visible
        loaderElement.querySelector('h2').textContent = message;
        return;
    }
    loaderElement = document.createElement("div");
    loaderElement.id = "loading-screen";
    loaderElement.style.position = "fixed";
    loaderElement.style.top = "0";
    loaderElement.style.left = "0";
    loaderElement.style.width = "100%";
    loaderElement.style.height = "100%";
    loaderElement.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
    loaderElement.style.color = "white";
    loaderElement.style.display = "flex";
    loaderElement.style.flexDirection = "column"; // Stack elements vertically
    loaderElement.style.justifyContent = "center";
    loaderElement.style.alignItems = "center";
    loaderElement.style.zIndex = "1050"; // Ensure loader is above username prompt if needed
    loaderElement.style.fontSize = '16px'; // Adjust the font size as needed
    loaderElement.innerHTML = `
        <style>
            .spinner {
                border: 4px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top: 4px solid #fff;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin-bottom: 20px; /* Space between spinner and text */
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
        <div class="spinner"></div>
        <h2>${message}</h2>
    `;
    document.body.appendChild(loaderElement);
}

function hideLoadingScreen() {
    if (loaderElement) {
        loaderElement.remove();
        loaderElement = null; // Reset the variable
    }
}

// --- Modified and New Functions ---

function handleCredentialResponse(response) {
    const payload = parseJwt(response.credential);
    console.log("User ID Token: ", response.credential);
    console.log("User Information: ", payload);

    const accountData = {
        token: response.credential,
        userInfo: payload,
        timestamp: new Date().toISOString()
    };

    showLoadingScreen("Authenticating..."); // Initial loading message

    server(response.credential, "getUserData", { name: payload.name, email: payload.email })
        .then(serverResponse => {
            if (serverResponse?.userData?.message) {
                // --- New User ---
                console.log("New user detected. Prompting for username.");
                hideLoadingScreen(); // Hide loading screen to show prompt
                showUsernamePrompt(accountData); // Pass the whole accountData

            } else {
                // --- User Exists ---
                console.log("User exists. Proceeding to login.");
                // Optionally add username from server response if available
                if (serverResponse?.userData?.username) {
                    accountData.userInfo.username = serverResponse?.userData?.username;
                }
                localStorage.setItem("account_data", JSON.stringify(accountData));
                hideLoadingScreen(); // Hide loading screen *before* redirect
                proceedToApp();
            }
        })
        .catch(error => {
            console.error("Error during getUserData:", error.message);
            hideLoadingScreen();
            alert(`Sign-in failed: ${error?.message || 'Could not connect to the server.'}`);
        });
}

function showUsernamePrompt(accountData) {
    const promptOverlay = document.getElementById('username-prompt-overlay');
    const promptBox = document.getElementById('username-prompt-box');
    const usernameInput = document.getElementById('username-input');
    const submitButton = document.getElementById('submit-username-button');
    const errorMessage = document.getElementById('username-error');
    const signinContainer = document.getElementById('signin-container');

    // Hide the original sign-in button container
    if (signinContainer) {
        signinContainer.classList.add('hidden');
    }

    // Clear previous input and errors
    usernameInput.value = '';
    errorMessage.textContent = '';
    promptOverlay.classList.remove('hidden'); // Show the prompt

    // Remove previous listener to avoid duplicates if function is called again
    const newSubmitButton = submitButton.cloneNode(true);
    submitButton.parentNode.replaceChild(newSubmitButton, submitButton);

    // Add event listener to the new button
    newSubmitButton.addEventListener('click', () => {
        const enteredUsername = usernameInput.value.trim();

        // Basic validation (you might want more robust checks)
        if (!enteredUsername) {
            errorMessage.textContent = 'Username cannot be empty.';
            return;
        }
        if (enteredUsername.length < 3) {
            errorMessage.textContent = 'Username must be at least 3 characters long.';
            return;
        }
        // Example: Check for invalid characters (allow letters, numbers, underscore, hyphen)
        if (!/^[a-zA-Z0-9_-]+$/.test(enteredUsername)) {
            errorMessage.textContent = 'Username can only contain letters, numbers, underscores, and hyphens.';
            return;
        }


        errorMessage.textContent = ''; // Clear error message
        showLoadingScreen("Creating your account..."); // Show loading for creation

        // Data to send for user creation
        const createUserData = {
            username: enteredUsername,
            email: accountData.userInfo.email, // Get email from payload
            name: accountData.userInfo.name    // Get name from payload
            // Add any other initial data needed by your backend here
        };

        server(accountData.token, "createUser", createUserData)
            .then(creationResponse => {
                console.log("Server Response (createUser):", creationResponse);

                if (creationResponse.status === 'success') {
                    // --- User Creation Successful ---
                    console.log("User created successfully.");
                    // Add the chosen username to the stored data
                    accountData.userInfo.username = enteredUsername;
                    localStorage.setItem("account_data", JSON.stringify(accountData));

                    promptOverlay.classList.add('hidden'); // Hide prompt
                    hideLoadingScreen(); // Hide loading before redirect
                    proceedToApp(); // Redirect to the main app page

                } else {
                    // --- User Creation Failed (e.g., username taken, server error) ---
                    hideLoadingScreen(); // Hide loading
                    errorMessage.textContent = `Failed to create user: ${creationResponse.message || 'Unknown error'}`;
                    console.error("User creation failed:", creationResponse);
                    // Keep the prompt visible for the user to try again or see the error
                }
            })
            .catch(error => {
                console.error("Error during createUser:", error.message);
                hideLoadingScreen();
                errorMessage.textContent = `Error: ${error.message || 'Could not create account.'}`;
                // Keep the prompt visible
            });
    });
}

// Function to handle redirection after successful login/signup
function proceedToApp() {
    try {
        // Check for a redirect parameter in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.get("redirect");

        console.log("Redirect URL from params:", redirectUrl);

        if (redirectUrl) {
            // Validate redirectUrl if necessary (e.g., ensure it's internal)
            // For simplicity, we directly use it here. Be cautious in production.
            safeReplace(redirectUrl);
        } else {
            // Default redirect if no parameter is found
            safeReplace("Flow"); // Or your main app page, e.g., "", "/app", "/home"
        }
    } catch (e) {
        console.error("Error parsing redirect URL or redirecting:", e);
        // Fallback redirect
        safeReplace("Flow"); // Or your main app page
    }
}