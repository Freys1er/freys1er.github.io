const TIME_PER_FLASHCARD = 300; // Milliseconds delay between adding each card (adjust as needed)

// Get DOM Elements
const generateButton = document.getElementById('generate-button');
const promptInput = document.getElementById('prompt-input');
const loadingOverlay = document.getElementById('loading-overlay');
const slider = document.getElementById("num-cards");
const sliderValue = document.getElementById("slider-value");
const mainContainer = document.querySelector('.container');
const generationSuccessDiv = document.getElementById('generation-success');
const flashcardList = document.getElementById('flashcard-list'); // Get the new UL element
const successMessageP = document.getElementById('success-message');
const countMessageP = document.getElementById('count-message');
const studyButton = document.getElementById('study-button');

// ... (slider.oninput, account_data, browserdata definitions) ...

slider.oninput = function () {
    sliderValue.textContent = this.value;
};

let account_data = {};
let browserdata = {}; // Define browserdata globally if not already

// --- Temporary storage for generated data ---
let generatedTitle = '';
let generatedCards = null;

// --- Function to be called when the button is pressed ---
function createFlashcards(promptText) {
    showLoading();
    // Do not hide main container yet, wait for response

    doGet(account_data.token, "gemini", {
        topic: promptText,
        amount: slider.value
    })
        .then((response) => {
            console.log("Response from server:", response);
            hideLoading(); // Hide loading FIRST

            if (response?.message?.includes("invalid_token")) {
                console.log("Token expired, redirecting to login...");
                safeReplace("Google/?redirect=Flow/Gemini");
                return;
            }
            if (response && response.flashcards && response.title) {
                const refined = rawFlashcardsToJSON(response.flashcards);
                console.log("Refined Flashcards:", refined);

                // Store data
                generatedTitle = response.title;
                generatedCards = refined;

                // --- Start Animation Flow ---
                mainContainer.style.display = 'none'; // Hide input form
                flashcardList.innerHTML = ''; // Clear any previous list items
                successMessageP.classList.add('hidden'); // Ensure final message is hidden
                studyButton.classList.add('hidden');   // Ensure study button is hidden
                studyButton.disabled = true; // Disable button until animation finishes
                generationSuccessDiv.style.display = 'block'; // Show the success area container

                // Start the card display animation
                animateFlashcardDisplay(generatedCards);

            } else {
                // Error case: Ensure main container is visible
                mainContainer.style.display = 'block';
                generationSuccessDiv.style.display = 'none';
                // Use toast for errors
                showToast(response?.message || "Error: No flashcards received or invalid format.", "error");
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            hideLoading();
            // Ensure main container is visible on error
            mainContainer.style.display = 'block';
            generationSuccessDiv.style.display = 'none';
            showToast("An error occurred while generating flashcards.", "error");
        });
}


// --- Event Listener for the NEW Study Button ---
studyButton.addEventListener('click', () => {
    // Add a check if the button is disabled (e.g. during animation)
    if (studyButton.disabled) {
        console.log("Study button clicked while disabled.");
        return;
    }

    if (generatedTitle && generatedCards) {
        // Disable button immediately to prevent double clicks
        studyButton.disabled = true;
        studyButton.textContent = 'Loading Set...';
        studyButton.classList.add('disabled'); // Visually disable

        // Use a small timeout for UI update feel
        setTimeout(() => {
            saveAndRedirectToPreview(generatedTitle, generatedCards);
        }, 50);
    } else {
        console.error("Missing generated title or cards for study button.");
        showToast("Error preparing study set. Please try generating again.", "error");
        // Reset UI state
        mainContainer.style.display = 'block';
        generationSuccessDiv.style.display = 'none';
        promptInput.value = '';
        updateButtonState();
        // Ensure button is re-enabled if error happens here
        studyButton.disabled = false;
        studyButton.classList.remove('disabled');
        studyButton.textContent = 'Study Now';
    }
});


function getUserDataFromServer() {
    showLoading(); // Show loading while fetching data

    const loadedData = loadBrowserAndAccountData(); // From utils.js
    // Make sure browserdata is assigned correctly
    browserdata = loadedData.browserdata || { saved: [] }; // Initialize if null/undefined
    account_data = loadedData.account_data;

    if (!account_data || !account_data.token) {
        console.log("No token found, redirecting to login...");
        hideLoading(); // Hide loading before redirect
        safeReplace("Google/?redirect=Flow/Gemini");
        return; // Stop execution
    }

    doGet(account_data.token, "getUserData", {})
        .then(serverResponse => {
            // Corrected logic: check for serverResponse.status === 'error' or missing data
            if (serverResponse?.status === 'error' || !serverResponse?.userData) {
                if (serverResponse?.message?.includes("invalid_token")) {
                    console.log("Token expired during getUserData, redirecting to login...");
                    safeReplace("Google/?redirect=Flow/Gemini");
                } else {
                    console.warn("getUserData response missing userData field or returned an error:", serverResponse?.message);
                    // Decide how to handle this - maybe proceed without server info? Or redirect?
                    // For now, let's try to proceed but warn the user.
                    showToast("Could not verify user data. Some features might be limited.", "info");
                    init(); // Attempt to init anyway
                }
            } else {
                // Status is likely 'ok' and userData exists
                account_data.serverInfo = serverResponse.userData;
                saveBrowserAndAccountData(browserdata, account_data); // Save updated data
                console.log("User data updated:", account_data.serverInfo);
                init(); // Proceed with initialization
            }
        })
        .catch(error => {
            console.error("Error fetching user data:", error);
            // Handle specific errors if possible, otherwise generic message
            showToast("Network error fetching user data. Please check connection.", "error");
            // Decide if you want to init() even on error or stop
            // Maybe try init with existing local data?
            init(); // Attempt to init with potentially stale data
        })
        .finally(() => {
            hideLoading(); // Always hide loading
        });
}

// Run initial setup
getUserDataFromServer();

function init() {
    console.log("Initializing with account data:", account_data);

    updateButtonState(); // Set initial button state

    // Re-check token just in case getUserData failed but we proceeded
    if (!account_data?.token) {
        console.log("No token found during init, redirecting to login...");
        safeReplace("Google/?redirect=Flow/Gemini");
        return; // Stop init
    }

    // Premium Checks (Make sure serverInfo exists before checking properties)
    if (!account_data?.serverInfo) {
        console.warn("Cannot perform premium checks: serverInfo is missing.");
        showToast("Could not verify subscription status.", "info");
        disableGenerateButton(); // Consider adding this function
        updateButtonState(); // Update visual state if disabled
    } else if (account_data.serverInfo.subscription !== "Premium") {
        showToast("Premium subscription required for Gemini features.", "error");
        console.log("User is not premium, redirecting to subscription page...");
        // Give user time to see the toast
        setTimeout(() => safeReplace("Flow/Profile"), 2500);
        disableGenerateButton(); // Disable button while waiting
        return;
    } else if (new Date(account_data.serverInfo.subscriptionexpiry) < Date.now()) {
        showToast("Your Premium subscription has expired.", "error");
        console.log("User premium expired, redirecting to subscription page...");
        setTimeout(() => safeReplace("Flow/Profile"), 2500);
        disableGenerateButton(); // Disable button while waiting
        return;
    }

    // If all checks pass, ensure the generate button is enabled (if it was disabled)
    enableGenerateButton();
    updateButtonState(); // Re-run to ensure visual state is correct based on input + premium status
}

// Renamed displayFlashcards to emphasize its action
function saveAndRedirectToPreview(topic, flashcards) {
    console.log(flashcards);
    const newSet = {
        name: topic,
        data: flashcards,
        setId: 'gemini_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7), // More uniqueness
        ownerName: "Gemini",
        createdAt: Date.now() // Add creation timestamp
    };

    // Ensure browserdata.saved is an array
    if (!browserdata || !Array.isArray(browserdata.saved)) {
        browserdata = { saved: [] };
        console.warn("browserdata.saved was not an array, re-initialized.");
    }

    // Save the new set to browserdata
    browserdata.saved.push(newSet);
    saveBrowserAndAccountData(browserdata, account_data); // Save to localStorage
    console.log("Saved new set:", newSet.setId);

    // Redirect to the Preview page with the new set
    safeReplace(`Flow/Preview/?setId=${newSet.setId}`);
}

// --- Helper Functions ---
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// --- Event Listener for Generate Button ---
generateButton.addEventListener('click', () => {
    // Check if the button is disabled before proceeding
    if (generateButton.classList.contains('disabled')) {
        console.log("Generate button is disabled.");
        return; // Do nothing if disabled
    }

    const prompt = promptInput.value.trim(); // Get text and remove whitespace

    if (prompt.length > 10) { // Only proceed if there is a prompt
        createFlashcards(prompt);
    } else {
        showToast("Please enter a topic (more than 10 characters).", "info");
    }
});

// Optional: Allow pressing Enter in the textarea to trigger generation
promptInput.addEventListener('keypress', function (e) {
    // Check if the button is disabled before proceeding
    if (generateButton.classList.contains('disabled')) {
        return;
    }
    const prompt = promptInput.value.trim();
    if (e.key === 'Enter' && !e.shiftKey) { // Check for Enter key without Shift
        e.preventDefault(); // Prevent default Enter behavior (new line)
        if (prompt.length > 10) { // Only proceed if there is a prompt
            createFlashcards(prompt);
        } else {
            showToast("Please enter a topic (more than 10 characters).", "info");
        }
    }
});

promptInput.addEventListener('input', updateButtonState);

// --- Function to update button state ---
let isPremiumUser = false; // Keep track if user status allows generation

function updateButtonState() {
    const prompt = promptInput.value.trim();
    const hasSufficientLength = prompt.length > 10;

    // Determine if the user is allowed to generate based on premium status
    // Re-evaluate premium status here based on potentially updated account_data
    isPremiumUser = account_data?.serverInfo?.subscription === "Premium" &&
        new Date(account_data?.serverInfo?.subscriptionexpiry) >= Date.now();

    // Also check if getUserData failed entirely
    const hasValidUserData = !!account_data?.serverInfo;


    if (hasSufficientLength && isPremiumUser) {
        enableGenerateButton();
    } else {
        disableGenerateButton();
    }
}


function disableGenerateButton() {
    generateButton.classList.add('disabled');
    // CSS already handles visual styling for .disabled
}

function enableGenerateButton() {
    // Only enable if the text length condition is also met
    if (promptInput.value.trim().length > 10) {
        generateButton.classList.remove('disabled');
    }
    // CSS already handles visual styling for non-disabled
}

// --- Toast Notification Function (ensure this is defined, perhaps in utils.js) ---
// Example implementation if not already present:
function showToast(message, type = 'info') { // type can be 'info', 'success', 'error'
    const toast = document.getElementById('toast-message');
    if (!toast) return; // Exit if toast element doesn't exist

    toast.textContent = message;
    toast.className = 'visible'; // Base class to make it visible
    if (type) {
        toast.classList.add(type); // Add specific type class (error, success, info)
    }

    // Automatically hide after a few seconds
    setTimeout(() => {
        toast.className = ''; // Remove all classes to hide it
    }, 4000); // Adjust timeout duration as needed (4 seconds)
}


// --- Raw Flashcards to JSON (ensure this is defined, perhaps in utils.js) ---
// Example implementation if not already present:
function rawFlashcardsToJSON(rawString) {
    const flashcards = [];
    const lines = rawString.trim().split('\n');
    let currentCard = null;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('Q:')) {
            // If we were processing a previous card, push it
            if (currentCard) {
                flashcards.push(currentCard);
            }
            // Start a new card
            currentCard = { question: trimmedLine.substring(2).trim(), answer: '' };
        } else if (trimmedLine.startsWith('A:') && currentCard) {
            currentCard.answer = trimmedLine.substring(2).trim();
        } else if (currentCard && currentCard.a === '') {
            // If it's not Q: or A: and we are waiting for an answer, append to question
            // This handles multi-line questions, although Gemini format is usually strict Q:/A:
            currentCard.question += '\n' + trimmedLine;
        } else if (currentCard && currentCard.a !== '') {
            // If it's not Q: or A: and we already have an answer, append to answer
            currentCard.answer += '\n' + trimmedLine;
        }
    }

    // Push the last card being processed
    if (currentCard) {
        flashcards.push(currentCard);
    }

    // Basic validation: check if any cards were actually created
    if (flashcards.length === 0 && rawString.length > 0) {
        console.log("Error parsing with Q: A: flashcard method, trying Pipe method...")
        return rawPipeFlashcardsToJSON(rawString);
    }


    return flashcards;
}

function rawPipeFlashcardsToJSON(rawString) {
    if (!rawString || typeof rawString !== 'string') return []; // Handle null/undefined/non-string input

    const flashcards = [];
    // Trim the input string first to remove leading/trailing whitespace/pipes
    const trimmedInput = rawString.trim().replace(/^\|+|\|+$/g, ''); // Remove leading/trailing pipes

    if (trimmedInput.length === 0) return []; // Return empty if string is just whitespace or pipes

    const segments = trimmedInput.split('|');

    // Iterate through segments taking two at a time (question, answer)
    for (let i = 0; i < segments.length - 1; i += 2) {
        const q = segments[i].trim();
        const a = segments[i + 1].trim();

        // Add the card even if q or a is empty after trimming,
        // as long as they came from distinct segments.
        // You could add a check here (e.g., `if (q)`) if you want to require non-empty questions.
        flashcards.push({ question: q, answer: a });
    }

    // Basic validation: check if any cards were created vs input length
    if (flashcards.length === 0 && trimmedInput.length > 0) {
        console.warn("rawPipeFlashcardsToJSON: Could not parse any Q|A pairs from raw string:", trimmedInput.substring(0, 100) + "...");
    } else if (segments.length % 2 !== 0 && trimmedInput.length > 0) {
        // Warn if there was an odd number of segments (last one ignored)
        console.warn("rawPipeFlashcardsToJSON: Input string had an odd number of segments. The last segment was ignored.");
    }


    return flashcards;
}


// --- safeReplace and load/save Browser/Account Data (ensure these are in utils.js) ---
// Make sure functions like safeReplace(), loadBrowserAndAccountData(), saveBrowserAndAccountData()
// are correctly defined and loaded (likely from ../utils.js).

function animateFlashcardDisplay(cards) {
    let index = 0;
    countMessageP.classList.remove('hidden');
    console.log(cards);

    function addNextCard() {
        if (index < cards.length) {
            const card = cards[index];
            const li = document.createElement('li');

            // Simple display: Show Question (truncated)
            const maxLen = 60; // Max characters of question to show in list
            const displayQ = card.question.length > maxLen ? card.question.substring(0, maxLen) + '...' : card.question;
            li.textContent = `Q: ${displayQ}`;
            li.title = `Q: ${card.question}\nA: ${card.answer}`; // Full content on hover (tooltip)

            flashcardList.appendChild(li);

            // Scroll list to bottom to show the latest card
            flashcardList.scrollTop = flashcardList.scrollHeight;

            index++;
            countMessageP.textContent = index + " out of " + cards.length;
            setTimeout(addNextCard, TIME_PER_FLASHCARD); // Schedule next card
        } else {
            // --- Animation Finished ---
            console.log("Flashcard animation complete.");

            // Show final success message and study button
            successMessageP.textContent = `Generated ${cards.length} flashcard${cards.length !== 1 ? 's' : ''} for "${generatedTitle}". Ready to study?`;
            successMessageP.classList.remove('hidden');
            studyButton.textContent = 'Study Now'; // Reset text just in case
            studyButton.disabled = false; // IMPORTANT: Re-enable the button
            studyButton.classList.remove('hidden');
            studyButton.classList.remove('disabled'); // Ensure visual style is updated
        }
    }

    // Start the animation chain
    if (cards.length > 0) {
        addNextCard();
    } else {
        // Handle case where Gemini returns 0 cards (shouldn't happen with validation, but good practice)
        successMessageP.textContent = `No flashcards were generated for "${generatedTitle}". Try a different topic or wording.`;
        successMessageP.classList.remove('hidden');
        // Keep study button hidden/disabled
        studyButton.classList.add('hidden');
        studyButton.disabled = true;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    generationSuccessDiv.style.display = 'none'; // Ensure hidden on load
    getUserDataFromServer(); // Fetch user data
});


