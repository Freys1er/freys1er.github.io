let account_data = {};
const urlParams = new URLSearchParams(window.location.search);
const giftCode = urlParams.get('code'); // Get the value of the 'code' parameter
const from = urlParams.get('from'); // Get the value of the 'code' parameter

const redeemCodeError = document.getElementById('redeem-code-error');



// --- Log the retrieved code (for debugging) ---
if (!giftCode) {
    console.log("No 'code' parameter found in the URL.");
    // Handle the case where the code is missing, if necessary
    // Maybe show an error, or default behavior.
}

// --- Data for the Card ---
// In a real application, this data might come from an API, etc.
setupGiftCardDisplay()

// This function is called when the user is confirmed to be logged in
function setupGiftCardDisplay() {
    // We'll fetch the 'from' name from the server now, based on the giftCode
    // const fromName = urlParams.get('from'); // No longer strictly needed if server provides it


    if (!giftCode) {
        console.error("Gift code is missing from URL, cannot fetch details.");
        // Handle this case - maybe show an error message to the user
        return; // Stop execution if no code is present
    }

    console.log("Attempting to fetch gift card details for code:", giftCode);

    // --- Fetch Card Data from Server ---
    // Call your doGet function
    // Assuming the server endpoint for details is /giftCardDetails?code=...
    doGet("", "giftCardDetails", {
        giftCardId: giftCode
    }) // Replace "" with actual path if doGet requires it
        .then(serverData => { // The serverData variable will hold the response from the server
            console.log("Successfully fetched gift card details:", serverData);


            // --- Select Elements ---
            const detailsContainer = document.querySelector('.card-details');
            const allDetailParagraphs = detailsContainer.querySelectorAll('p');

            if (serverData.error) {
                redeemCodeError.textContent = serverData.error
                redeemCodeError.style.display = "block"; // Show error message
            }

            console.log(serverData.subscriptionType);

            // --- Data for the Card ---
            // Use the data received from the server
            // Assuming serverData is an object like { type: "Premium", senderName: "Freyster" }
            const cardData = {
                type: serverData.subscriptionType || "Premium", // Use server data, provide fallback
                duration: serverData.durationDays + " days",
                from: serverData.senderName || from || 'Someone Nice' // Prioritize server data, then URL, then default
            };

            console.log(cardData)

            // Correct ID based on HTML: detail-duration
            const subscriptionElement = document.getElementById('detail-type');
            const durationElement = document.getElementById('detail-duration');
            const fromElement = document.getElementById('detail-from');

            // Check if the required elements exist before proceeding
            if (!detailsContainer || !subscriptionElement || !fromElement || allDetailParagraphs.length === 0) {
                console.error("Gift card display elements not found after fetching data.");
                return; // Stop if elements aren't present
            }


            // --- Populate Details Content ---
            // Use the populated cardData object
            subscriptionElement.textContent = cardData.type;
            durationElement.textContent = cardData.duration;
            fromElement.textContent = `From: ${cardData.from}`;


            // --- Timing Logic for Fade-in Animation ---
            const staggerDelay = 300;

            allDetailParagraphs.forEach((detailParagraph, index) => {
                setTimeout(() => {
                    detailParagraph.classList.add('visible');
                }, index * staggerDelay);
            });



        }) // End of .then() block
        .catch(error => {
            // --- Handle errors from the server request ---
            console.error("Error fetching gift card details:", error);
            // Show an error message to the user (e.g., "Could not load gift card details.")
            const detailsContainer = document.querySelector('.card-details');
            if (detailsContainer) {
                detailsContainer.innerHTML = '<p style="color: red;">Error loading gift card details.</p>';
                detailsContainer.style.display = 'block'; // Make sure container is visible to show error
            }
        }); // End of .catch() block

    // IMPORTANT: The rest of the script (populating details, animations, button listener)
    // needs to be inside the .then() block, because it depends on the data fetched from the server.
    // Code placed *after* this .catch() would run *before* the fetch completes.

} // End of setupGiftCardDisplay function

function handleCredentialResponse(response) {
    console.log("Google Sign-In successful. Received credential.");

    // Step 1: Get the ID token
    const idToken = response.credential;

    account_data.token = idToken;

    redeemCode(giftCode);
}

async function redeemCode(code) {
    try {
        const result = await doGet(account_data?.token, "redeemGiftCard", { giftCardId: code });
        if (result.status === 'success') {
            safeReplace('Flow/Profile')
        } else {
            redeemCodeError.textContent = `Failed to redeem code: ${result.error}`; // Show error message
            redeemCodeError.style.display = "block"; // Show error message
        }
    } catch (error) {
        console.error("Error redeeming code:", error);

        redeemCodeError.textContent = "Error redeeming code. Please try again later."; // Show error message
        redeemCodeError.style.display = "block"; // Show error message
    }
}
