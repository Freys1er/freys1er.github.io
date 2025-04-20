// Search/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let browserdata = {};
    let account_data = null;
    let currentQuery = '';

    // --- DOM Elements ---
    const loadingOverlay = document.getElementById('loading-overlay');
    const backButton = document.getElementById('search-back-btn');
    const searchInput = document.getElementById('search-results-input');
    const resultsContainer = document.getElementById('search-results-container');
    const resultsList = document.getElementById('search-results-list');
    const searchInfo = document.getElementById('search-info');
    const loadingPlaceholder = document.getElementById('search-loading-placeholder');
    const searchMessage = document.getElementById('search-message');

    // --- Initialization ---
    function init() {
        const loadedData = loadBrowserAndAccountData(); // from utils.js
        browserdata = loadedData.browserdata;
        account_data = loadedData.account_data;

        setupEventListeners();

        // Get query from URL
        const urlParams = new URLSearchParams(window.location.search);
        currentQuery = urlParams.get('query') || '';
        searchInput.value = currentQuery;

        // Perform search if query exists
        if (currentQuery) {
            performSearch(currentQuery);
        } else {
            showInfoMessage("Enter a query to search for sets.");
        }
    }

    function showLoading() {
        resultsList.innerHTML = ''; // Clear previous results
        searchMessage.textContent = '';
        loadingPlaceholder.classList.remove('hidden');
        searchInfo.classList.remove('hidden');
        if (loadingOverlay) loadingOverlay.classList.add('visible'); // Show full overlay
    }

    function hideLoading() {
        loadingPlaceholder.classList.add('hidden');
        if (loadingOverlay) loadingOverlay.classList.remove('visible'); // Hide full overlay
        // Keep searchInfo visible if there's a message
        if (!searchMessage.textContent) {
            searchInfo.classList.add('hidden');
        }
    }

    function showInfoMessage(message) {
        resultsList.innerHTML = ''; // Clear results
        searchMessage.textContent = message;
        loadingPlaceholder.classList.add('hidden');
        searchInfo.classList.remove('hidden');
        hideLoading(); // Ensure spinner overlay is hidden
    }

    // --- Search Logic ---
    async function performSearch(query) {
        if (!query) {
            showInfoMessage("Please enter a search term.");
            return;
        }
        currentQuery = query; // Update current query state
        showLoading();

        try {
            // Assume 'server' function is global (from ../server.js)
            const results = await doGet(account_data?.token, "searchSet", { query: query.toLowerCase() });

            // Process results (handle potential variations in response format)
            let searchResults = [];
            if (Array.isArray(results)) {
                searchResults = results;
            } else if (results && typeof results === 'object' && Array.isArray(results.data)) {
                // Handle cases where results are nested like { data: [...] }
                searchResults = results.data;
            } else if (typeof results === 'string') {
                // Try parsing if it's a JSON string
                try {
                    const parsed = JSON.parse(results);
                    if (Array.isArray(parsed)) {
                        searchResults = parsed;
                    } else {
                        throw new Error("Parsed result is not an array.");
                    }
                } catch (parseError) {
                    console.error("Failed to parse search response string:", parseError);
                    throw new Error("Invalid search response format from server.");
                }
            } else {
                // Handle other unexpected formats
                console.warn("Unexpected search result format:", results);
                searchResults = []; // Default to empty on unexpected format
            }

            renderSearchResults(searchResults);

        } catch (error) {
            console.error("Search failed:", error);
            showInfoMessage(`Search failed: ${error.message}`);
            resultsList.innerHTML = ''; // Clear list on error
        } finally {
            hideLoading();
        }
    }

    // --- Rendering ---
    function renderSearchResults(results) {
        resultsList.innerHTML = ''; // Clear previous results

        if (!results || results.length === 0) {
            showInfoMessage(`No results found for "${currentQuery}".`);
            return;
        }

        searchInfo.classList.add('hidden'); // Hide info message area if results found

        results.forEach((result) => {
            // Ensure result has necessary fields
            const set = {
                setId: result.setId || `search_${Date.now()}_${Math.random()}`, // Generate temporary ID if missing
                name: result.setName || result.name || 'Untitled Set',
                count: result.count || (result.data ? result.data.length : 0), // Estimate count
                ownerName: result.ownerName || result.owner || 'Unknown Owner', // Allow 'owner' as fallback
                modified: result.modified, // Pass along modified date if available
                color: result.color, // Use color if provided
                // Add any other relevant fields you expect from search results
            };
            const li = createSearchResultItem(set);
            resultsList.appendChild(li);
        });
    }

    /** Creates a list item for a search result */
    function createSearchResultItem(set) {
        const li = document.createElement('li');
        li.className = 'set-item'; // Use common styling
        li.dataset.setId = set.setId;

        const color = set.color || textToColor(set.name); // from utils.js
        const textColor = getContrastColor(color); // from utils.js
        const count = set.count || 0;
        // Provide more context in search results
        const message = `By: ${set.ownerName}${set.modified ? ' | ' + formatDate(set.modified) : ''}`; // from utils.js

        li.innerHTML = `
            <div class="set-thumbnail" style="background-color: ${color}; color: ${textColor};">${count}</div>
            <div class="set-details">
                <div class="set-title">${set.name}</div>
                <div class="set-message">${message}</div>
            </div>`;

        li.addEventListener('click', () => {
            // Redirect to Preview page for this set
            safeReplace(`Flow/Preview/?setId=${set.setId}`);
        });
        return li;
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        if (backButton) {
            backButton.addEventListener('click', () => {
                safeReplace("Flow");
            });
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = searchInput.value.trim();
                    if (query && query !== currentQuery) { // Only search if query changed
                        performSearch(query);
                        // Optional: Update URL without full reload
                        const url = new URL(window.location);
                        url.searchParams.set('query', query);
                        window.history.pushState({ query: query }, '', url);
                    } else if (!query) {
                        showInfoMessage("Please enter a search term.");
                        resultsList.innerHTML = ''; // Clear results if query is empty
                    }
                }
            });
        }

        // Optional: Handle back/forward browser navigation updating search
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.query) {
                searchInput.value = event.state.query;
                performSearch(event.state.query);
            } else {
                // Handle case where state is missing or going back to initial load state
                const urlParams = new URLSearchParams(window.location.search);
                const queryFromUrl = urlParams.get('query') || '';
                searchInput.value = queryFromUrl;
                performSearch(queryFromUrl);
            }
        });
    }

    // --- Start ---
    init();
});
