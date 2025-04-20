document.addEventListener('DOMContentLoaded', () => {
    // --- Gift Card and CTA Code (Keep as is) ---
    const giftCardInput = document.getElementById('giftCardCode');
    const redeemButton = document.getElementById('redeemButton');
    const redeemMessage = document.getElementById('redeemMessage');


    const loadedData = loadBrowserAndAccountData(); // from utils.js
    browserdata = loadedData.browserdata;
    account_data = loadedData.account_data;
    getUserDataFromServer();


    function getUserDataFromServer() {
        if (!account_data || !account_data.token) {
            giftCardInput.hidden = true;
            redeemButton.textContent = 'Sign in to Redeem';
            console.log("Not logged in")
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
                        giftCardInput.hidden = true;
                        redeemButton.textContent = 'Sign in to Redeem';
                        console.log("Token expired")

                        account_data.token = null;
                    }
                } else {
                    console.warn("getUserData response missing userData field.");
                }
            })
            .catch(error => {
                console.error("Error fetching user data:", error.message);
                // Optional: show toast to user
                // showToast("Could not update user data.", "error");
            })
    }

    async function redeemCardCode(code) {
        try {
            const result = await doGet(account_data?.token, "redeemGiftCard", { giftCardId: code });
            if (result.status === 'success') {
                redeemMessage.textContent = `Failed to redeem code: ${result.error}`; // Show error message
                redeemMessage.style.color = "var(--green-color)"; // Correct
                redeemMessage.style.display = "block"; // Show message
                showToast("Code redeemed successfully!", "success");
                // Optionally refresh profile data or update UI
            } else {
                showToast(`Failed to redeem code: ${result.error}`, "error");

                redeemMessage.textContent = `Failed to redeem code: ${result.error}`; // Show error message
                redeemMessage.style.color = "#ff453a"; // Apple Red for error
                redeemMessage.style.display = "block"; // Show error message
            }
        } catch (error) {
            console.error("Error redeeming code:", error);
            showToast("Error redeeming code. Please try again later.", "error");

            redeemMessage.textContent = "Error redeeming code. Please try again later."; // Show error message
            redeemMessage.style.color = "#ff453a"; // Apple Red for error
            redeemMessage.style.display = "block"; // Show error message
        }
    }

    // --- Event Listener for Redeem Button Click ---
    if (redeemButton) {
        redeemButton.addEventListener('click', () => {
            const code = giftCardInput.value.trim();
            if (!account_data?.token) {
                safeReplace("Google/?redirect=Flow/Premium");
            }

            if (code) {
                redeemCardCode(code.toUpperCase());
            } else {
                redeemMessage.textContent = "Please enter a code.";
                redeemMessage.style.color = "#ff453a"; // Apple Red
                giftCardInput.focus();
            }
        });
    }

    // --- Event Listener for Enter Key Press in Input Field ---
    if (giftCardInput) {
        giftCardInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const code = giftCardInput.value.trim();
                if (code) {
                    redeemCardCode(code);
                } else {
                    redeemMessage.textContent = "Please enter a code.";
                    redeemMessage.style.color = "#ff453a"; // Apple Red
                }
            }
        });
    }

    // --- Optional: CTA Button Action ---
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('click', () => {
            const emailAddress = 'lfrey.0001@gmail.com'; // Replace with the actual email address
            const subject = 'Flow - Premium'; // Optional: Set a default subject
            const body = 'Hello, I am interested in '; // Optional: Set a default body

            // Construct the mailto link
            const mailtoLink = `mailto:${encodeURIComponent(emailAddress)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

            // Open the email client
            window.location.href = mailtoLink;
        });
    }


    // --- Intersection Observer for GENERAL Scroll Animations ---
    // Use a distinct name for this observer
    const generalAnimatedElements = document.querySelectorAll('.animate-on-scroll');

    if (generalAnimatedElements.length > 0) {
        const scrollObserver = new IntersectionObserver((entries, observer) => { // Renamed to scrollObserver
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target); // Animate only once
                }
                // Optional: Reverse animation when scrolling out of view
                // else {
                //     entry.target.classList.remove('is-visible');
                // }
            });
        }, {
            rootMargin: '0px',
            threshold: 0.15 // Trigger when 15% visible
        });

        generalAnimatedElements.forEach(el => {
            scrollObserver.observe(el); // Use scrollObserver
        });
    }

    // --- Intersection Observer specifically for the Performance Graph SECTION ---
    // Use a distinct name for this observer
    const performanceSection = document.querySelector('.performance-section');

    if (performanceSection) { // Check if the section exists
        const graphObserverOptions = {
            root: null,
            rootMargin: '0px',
            // Trigger when the SECTION starts entering the viewport
            // Adjust threshold if needed, 0.1 means 10% of the section is visible
            threshold: 0.1
        };

        const graphObserverCallback = (entries, observer) => {
            entries.forEach(entry => {
                // If the performance SECTION is intersecting
                if (entry.isIntersecting) {
                    console.log("Performance section is intersecting, adding is-visible."); // Debug log
                    entry.target.classList.add('is-visible'); // Add class to the SECTION
                    observer.unobserve(entry.target); // Stop observing the section once visible
                }
            });
        };

        // Create the observer for the graph section
        const graphObserver = new IntersectionObserver(graphObserverCallback, graphObserverOptions); // Renamed to graphObserver

        // Observe the single performance section element
        console.log("Observing performance section:", performanceSection); // Debug log
        graphObserver.observe(performanceSection); // Use graphObserver
    } else {
        console.log("Performance section not found."); // Debug log
    }


    // --- Video Ended Listener (Keep as is) ---
    const video = document.getElementById('preview');
    if (video) { // Good practice to check if element exists
        video.addEventListener('ended', () => {
            video.pause();
        });
    } else {
        console.log("Preview video element not found.");
    }
});