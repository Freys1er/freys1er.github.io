// Preview/script.js

document.addEventListener('DOMContentLoaded', () => {
	// --- State Variables ---
	let currentView = 'LOADING'; // 'PREVIEW', 'FLASHCARDS', 'EDIT'
	let browserdata = {};
	let account_data = null;
	let currentSetId = null;
	let currentSetData = null; // Holds the full data for the currently viewed/edited set
	let isCardFlipped = false;
	let sessionStartTime = null; // Set when entering flashcards view
	let LAST_INTERACTION = Date.now();
	let isNewSet = false; // Flag for creating a new set
	let oldSetData = null; // For tracking changes in edit mode
	let card = null;         // Holds the current card object { question: '...', answer: '...' }
	let nextCard = null;     // Holds the next card object for the 'behind' preview

	// Swipe constants
	const HORIZONTAL_SWIPE_THRESHOLD_RATIO = 0.3;
	const COPY_DRAG_THRESHOLD_RATIO = 0.20;
	const VELOCITY_THRESHOLD = 0.05;
	const MAX_FLICK_DURATION = 350;
	const SWIPE_ANIMATION_DURATION = 0.2; // seconds
	const SWIPE_PROJECTION_FACTOR = 15;
	const USER_MEMORY_LIMIT = 2;
	const USER_MEMORY_SCALE = 1.5;

	// --- DOM Elements ---
	const loadingOverlay = document.getElementById('loading-overlay');
	const toastMessage = document.getElementById('toast-message'); // Assume exists from utils.js

	const pages = {
		preview: document.getElementById('page-preview'),
		flashcards: document.getElementById('page-flashcards'),
		edit: document.getElementById('page-edit'),
	};

	// Preview Page Elements
	const previewHomeBtn = document.getElementById('preview-home-btn');
	const setTitleEl = document.getElementById('set-detail-title');
	const setCreatorEl = document.getElementById('set-creator');
	const studyButton = document.getElementById('study-set-button');
	const editButton = document.getElementById('edit-set-button');
	const tabNav = pages.preview?.querySelector('.secondary-nav'); // Use optional chaining
	const tabContentContainer = pages.preview?.querySelector('.tab-content');
	const previewContent = document.getElementById('preview-content');
	const statsContent = document.getElementById('stats-content');
	const permissionsContent = document.getElementById('permissions-content');
	const cardCountEl = document.getElementById('card-count');
	const flashcardListUl = document.getElementById('flashcard-list');
	const userAvgTimeEl = document.getElementById('user-avg-time');
	const communityAvgTimeEl = document.getElementById('community-avg-time');
	const detailsSetIdEl = document.getElementById('details-set-id');
	const lastUpdatedEl = document.getElementById('last-updated-date');
	const editorsListUl = document.getElementById('editors-list');
	const viewersListUl = document.getElementById('viewers-list');

	// Flashcards Page Elements
	const flashcardsBackBtn = document.getElementById('flashcards-back-btn');
	const flashcardsSetTitle = document.getElementById('flashcards-set-title');
	const flashcardsSetCount = document.getElementById('flashcards-set-count');
	const flashcardsEditBtn = document.getElementById('flashcards-edit-btn');
	const flashcardContainer = document.getElementById('flashcard-container');
	const flashcardOuter = document.getElementById('flashcard-outer');
	const flashcardInner = document.getElementById('flashcard-inner');
	const flashcardFrontText = document.getElementById('flashcard-front-text');
	const flashcardBackText = document.getElementById('flashcard-back-text');
	const flashcardBehind = document.getElementById('flashcard-behind');
	const flashcardBehindText = document.getElementById('flashcard-behind-text');
	const controlLeft = document.getElementById('control-left');
	const controlInfo = document.getElementById('control-info');
	const controlRight = document.getElementById('control-right');
	const quickViewContainer = document.getElementById('quick-view-container');
	const quickViewList = document.getElementById('quick-view-list');

	// Edit Page Elements
	const editBackBtn = document.getElementById('edit-back-btn');
	const editSaveBtn = document.getElementById('edit-save-btn');
	const editTextArea = document.getElementById('edit-textarea');


	// --- Helper Functions ---

	// Check login status based on presence of token or essential user info
	function isUserLoggedIn() {
		return !!(account_data && (account_data.token || account_data.userInfo?.sub));
	}

	// Show login prompt using toast notification (requires showToast in utils.js)
	function showLoginPrompt(action = "perform this action") {
		if (typeof showToast === 'function') {
			showToast(`Please log in to ${action}.`, 'info', 3000);
			// TODO: Optionally add a login button/link to the toast
			safeReplaceWrapper("Google/?redirect=" + encodeURIComponent(window.location.href));
		} else {
			alert(`Please log in to ${action}.`); // Fallback
		}
	}

	// Wrapper for saveBrowserAndAccountData from utils.js
	function saveBrowserAndAccountDataWrapper(browserData, accountData) {
		if (typeof saveBrowserAndAccountData === 'function') {
			saveBrowserAndAccountData(browserData, accountData);
		} else {
			console.error("Error: 'saveBrowserAndAccountData' function not found. Cannot save data.");
			showError("Critical save error: Cannot save progress.");
		}
	}

	// Wrapper for safeReplace from utils.js
	function safeReplaceWrapper(path) {
		if (typeof safeReplace === 'function') {
			safeReplace(path);
		} else {
			console.warn("'safeReplace' function not found, using basic redirect.");
			try {
				// Attempt to construct URL relative to /Flow/ assuming it's the base
				const targetUrl = new URL(path, window.location.origin + (window.location.pathname.includes('/Flow/') ? '/Flow/' : '/'));
				window.location.href = targetUrl.href;
			} catch (e) {
				window.location.href = "../" + path; // Fallback relative path
			}
		}
	}

	// Helper to format date (example)
	function formatDate(isoString) {
		if (!isoString) return 'Unknown';
		try {
			// More robust formatting
			const date = new Date(isoString);
			if (isNaN(date.getTime())) return 'Invalid Date'; // Check if date is valid
			return date.toLocaleDateString(undefined, {
				year: 'numeric', month: 'short', day: 'numeric',
				// hour: 'numeric', minute: '2-digit' // Optionally add time
			});
		} catch (e) {
			console.error("Error formatting date:", e);
			return 'Invalid Date';
		}
	}

	// --- Initialization ---
	function init() {
		showLoading("Initializing...");
		// Ensure core utils are loaded
		if (typeof loadBrowserAndAccountData !== 'function' || typeof saveBrowserAndAccountData !== 'function') {
			showError("Core utility functions missing. App cannot function correctly.");
			return; // Stop initialization
		}
		const loadedData = loadBrowserAndAccountData();
		browserdata = loadedData.browserdata || { saved: [], settings: {} };
		account_data = loadedData.account_data || null;
		console.log("User logged in:", isUserLoggedIn());

		const urlParams = new URLSearchParams(window.location.search);
		currentSetId = urlParams.get('setId');
		isNewSet = urlParams.has('new');

		setupEventListeners();

		// Handle routing based on URL parameters
		if (isNewSet) {
			if (isUserLoggedIn()) {
				createNewSet();
			} else {
				showLoginPrompt("create a new set");
				showError("Login required to create a new set.");
				// Clean URL and redirect or show error state more permanently
				history.replaceState(null, '', window.location.pathname + window.location.search.replace(/[?&]new/, ''));
				// setTimeout(() => { safeReplaceWrapper("Flow"); }, 3000); // Optional redirect
			}
		} else if (currentSetId) {
			loadSetData(currentSetId); // Loading allowed when logged out
		} else {
			showError("No Set ID provided in URL.");
			setTimeout(() => { safeReplaceWrapper("Flow"); }, 3000);
		}

		// Event listeners for tracking study time
		window.addEventListener('unload', trackStudySession);
		window.addEventListener('pagehide', trackStudySession);
		window.addEventListener('beforeunload', (event) => {
			trackStudySession(); // Attempt to track before leaving
			if (currentView === 'EDIT' && hasUnsavedChanges()) {
				event.preventDefault();
				event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
			}
		});
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden' && currentView === 'FLASHCARDS') {
				trackStudySession();
			} else if (document.visibilityState === 'visible' && currentView === 'FLASHCARDS') {
				sessionStartTime = Date.now(); // Restart timer on returning
			}
		});
	}

	// --- Loading/Error/Toast Functions ---
	function showLoading(message = "Loading...") {
		if (loadingOverlay) {
			loadingOverlay.querySelector('p').textContent = message;
			loadingOverlay.classList.add('visible');
		}
		disableButtons(true); // Disable actions while loading
	}
	function hideLoading() {
		if (loadingOverlay) loadingOverlay.classList.remove('visible');
		disableButtons(false); // Re-enable buttons (render functions will adjust specific states)
	}
	function disableButtons(disabled) {
		// Disable all major action buttons globally
		[studyButton, editButton, flashcardsEditBtn, editSaveBtn].forEach(btn => {
			if (btn) btn.disabled = disabled;
		});
	}
	function showError(message) {
		console.error(message);
		if (typeof showToast === 'function') showToast(message, 'error', 5000); // Show longer
		else alert(`Error: ${message}`);
		hideLoading();
		// Update UI to reflect error state
		if (setTitleEl) setTitleEl.textContent = "Error";
		if (setCreatorEl) setCreatorEl.textContent = message;
		// Keep core action buttons disabled after a load error
		if (studyButton) studyButton.disabled = true;
		if (editButton) editButton.disabled = true;
		if (flashcardsEditBtn) flashcardsEditBtn.disabled = true;
		if (editSaveBtn) editSaveBtn.disabled = true;
	}

	// --- Data Handling ---
	function createNewSet() {
		// Assumes user is logged in (checked in init)
		showLoading("Creating New Set...");
		const tempId = 'local_' + Date.now() + Math.random().toString(16).substring(2, 8);
		currentSetData = {
			setId: tempId,
			name: "Untitled Set",
			data: [],
			ownerName: account_data?.serverInfo?.username || account_data?.userInfo?.name || 'You',
			OwnerID: account_data?.serverInfo?.userId || account_data?.userInfo?.sub,
			created: new Date().toISOString(),
			modified: new Date().toISOString(),
			opened: new Date().toISOString(),
			isLocal: true,
			editors: [account_data?.serverInfo?.userId || account_data?.userInfo?.sub].filter(Boolean), // Add owner as editor
			viewers: [] // Define default viewer access (e.g., empty = owner only?)
		};
		currentSetId = currentSetData.setId;
		console.log("Created new local set:", currentSetData);
		if (!browserdata.saved) browserdata.saved = [];
		browserdata.saved.unshift(JSON.parse(JSON.stringify(currentSetData)));
		saveBrowserAndAccountDataWrapper(browserdata, account_data);
		switchView('EDIT'); // Go straight to editing the new set
		hideLoading();
	}

	async function loadSetData(setId) {
		showLoading("Loading Set Data...");
		console.log(`Attempting to load set: ${setId}`);
		let foundSet = null;

		if (browserdata.saved) {
			foundSet = browserdata.saved.find(set => set.setId === setId);
		}

		if (foundSet) {
			console.log("Found set in localStorage.");
			currentSetData = JSON.parse(JSON.stringify(foundSet)); // Use deep copy
			currentSetData.data = currentSetData.data || [];
			updateSetOpenedTimestamp();
			switchView('PREVIEW');
			hideLoading(); // Hide loading after local load is complete

			// Check for updates in background ONLY if logged in and it's a server set
			if (isUserLoggedIn() && !currentSetData.isLocal && typeof doGet === 'function') {
				fetchSetFromServer(setId, true).catch(err => {
					console.warn("Background update check failed:", err);
					// Do not show loading/errors for background checks
				});
			}
		} else {
			console.log("Set not found locally, trying server.");
			if (typeof doGet === 'function') {
				// Pass token if available, otherwise server handles anonymous request
				fetchSetFromServer(setId, false); // This function handles its own loading/error display
			} else {
				showError("Cannot fetch set: Server connection unavailable.");
				// No redirect here, let user see the error
			}
		}
	}

	async function fetchSetFromServer(setId, isUpdateCheck = false) {
		if (typeof doGet !== 'function') {
			if (!isUpdateCheck) showError("Cannot fetch set: Configuration error.");
			return;
		}

		// Show loading indicator only for initial fetch, not background checks
		if (!isUpdateCheck) showLoading("Fetching Set from Server...");

		try {
			const token = isUserLoggedIn() ? account_data.token : "-";
			if (!isUpdateCheck && typeof showToast === 'function') showToast(`Fetching set "${setId}"...`, 'info', 1500);

			const response = await doGet(token, "getSet", { setId: setId });
			console.log("Server response for getSet:", response);

			if (!response) throw new Error("No response received from server.");
			if (response.error === "User is not authorized to view this set.") {
				throw new Error("You don't have permission to view this set.");
			}
			if (response.error) throw new Error(response.error);
			if (!response.data && !response.File) throw new Error("Invalid data format received.");

			// Process Server Response (Structured data preferred)
			let fetchedSetData = {};
			if (response.data) {
				fetchedSetData = {
					setId: response.data.setId || setId,
					name: response.data.Name || 'Untitled Set',
					ownerName: response.data.Owner || 'Unknown Owner',
					OwnerID: response.data.OwnerID,
					editors: response.data.Editors || [],
					viewers: response.data.Viewers || [],
					modified: response.data.modified || new Date().toISOString(),
					data: response.data.File ? rawFlashcardsToJSON(response.data.File) : (response.data.data || []),
					created: response.data.created,
				};
			} else if (response.File) { // Legacy fallback
				fetchedSetData = {
					setId: setId, name: response.name || 'Untitled Set', data: rawFlashcardsToJSON(response.File),
					ownerName: response.ownerName || 'Unknown', OwnerID: response.OwnerID || null,
					editors: response.editors || [], viewers: response.viewers || [],
					modified: response.modified || new Date().toISOString(), created: response.created
				};
			} else { throw new Error("No usable set data found in response."); }

			// Data Consistency & Post-processing
			fetchedSetData.data = (fetchedSetData.data || []).map(card => ({
				question: card?.question || '', answer: card?.answer || ''
			}));
			fetchedSetData.opened = new Date().toISOString();
			fetchedSetData.isLocal = false; // Mark as from server

			// Handle Update Check vs. Initial Load
			if (isUpdateCheck && currentSetData) {
				if (fetchedSetData.modified > (currentSetData.modified || '')) {
					if (typeof showToast === 'function') showToast(`Set "${fetchedSetData.name}" updated locally.`, 'info');
					currentSetData = fetchedSetData;
					saveCurrentSetToLocal(); // Save update to local storage
					renderCurrentView(); // Refresh the current view
				} else { console.log("Local set is up-to-date."); }
			} else { // Initial Load
				if (typeof showToast === 'function') showToast(`Set "${fetchedSetData.name}" loaded.`, 'success');
				currentSetData = fetchedSetData;
				saveCurrentSetToLocal(); // Save fetched set locally
				switchView('PREVIEW');
			}
		} catch (error) {
			console.error("Failed to fetch/process set from server:", error);
			if (!isUpdateCheck) {
				showError(`Failed to load set: ${error.message}`);
				// If permission error, clear potential stale local data
				if (error.message.includes("permission")) currentSetData = null;
			} else { console.warn("Background update check failed:", error.message); }
		} finally {
			// Always hide loading indicator after fetch attempt (initial or background)
			hideLoading();
		}
	}

	// Parses raw string format (e.g., "Q1|A1|Q2|A2") into objects
	function rawFlashcardsToJSON(rawString) {
		if (!rawString || typeof rawString !== 'string') return [];
		const parts = rawString.split('|');
		const cards = [];
		for (let i = 0; i < parts.length; i += 2) {
			cards.push({
				question: (parts[i] || '').trim(),
				answer: (parts[i + 1] || '').trim()
			});
		}
		// Filter out potential empty card if string ends with |
		return cards.filter(c => c.question || c.answer);
	}

	// Converts array of {q, a} objects back to raw string format
	function jsonFlashcardsToRaw(cardArray) {
		if (!Array.isArray(cardArray)) return '';
		return cardArray.map(card => `${card.question || ''}|${card.answer || ''}`).join('|');
	}

	// Saves the currentSetData back to browserdata and localStorage
	function saveCurrentSetToLocal() {
		if (!currentSetData || !currentSetData.setId) {
			console.error("Cannot save locally: currentSetData is invalid."); return;
		}
		if (!browserdata || typeof browserdata.saved === 'undefined') {
			console.warn("Initializing browserdata.saved array.");
			browserdata = { saved: [], ...(browserdata || {}) };
		}
		currentSetData.modified = new Date().toISOString();
		currentSetData.opened = new Date().toISOString();
		const existingIndex = browserdata.saved.findIndex(s => s.setId === currentSetData.setId);
		const dataToSave = JSON.parse(JSON.stringify(currentSetData));

		if (existingIndex > -1) { browserdata.saved[existingIndex] = dataToSave; }
		else { browserdata.saved.unshift(dataToSave); }
		saveBrowserAndAccountDataWrapper(browserdata, account_data);
		console.log(`Set ${currentSetData.setId} saved locally.`);
	}

	// Handles saving set data (local + server logic)
	async function saveSetData() {
		if (!currentSetData) return;

		saveCurrentSetToLocal(); // Always save locally first

		const isExistingServerSet = !currentSetData.isLocal;
		const isNewLocalSet = currentSetData.isLocal;

		// Attempt server save only if logged in AND it's relevant (new or existing server set)
		if (isUserLoggedIn() && (isExistingServerSet || isNewLocalSet)) {
			if (typeof doGet !== 'function') {
				showError("Cannot save online: Server connection unavailable.");
				return; // Don't proceed without server function
			}
			showLoading("Saving Set Online...");
			try {
				let response = null;
				let serverPayload = { setId: currentSetData.setId };

				if (isExistingServerSet) { // Update existing
					console.log("Attempting update on server:", currentSetData.setId);
					serverPayload.action = "commit"; // Or "File"
					serverPayload.changes = changeToCommitedFormat(oldSetData || [], currentSetData.data);
					// serverPayload.name = currentSetData.name; // Include other changes if needed

					if (serverPayload.action === "commit" && serverPayload.changes.length === 0) {
						showToast(`No changes to save online.`, 'info'); hideLoading(); return;
					}
					response = await doGet(account_data.token, "updateSet", serverPayload);

				} else { // Create new on server
					console.log("Attempting create on server:", currentSetData.name);
					response = await doGet(account_data.token, "createSet", {
						name: currentSetData.name,
						data: jsonFlashcardsToRaw(currentSetData.data),
						editors: currentSetData.editors, viewers: currentSetData.viewers
					});
				}

				console.log("Server save response:", response);
				if (response?.success) {
					if (isNewLocalSet && response.setId) { // Handle new set creation response
						const oldLocalId = currentSetData.setId;
						const serverSetId = response.setId;
						const oldIndex = browserdata.saved.findIndex(s => s.setId === oldLocalId);
						if (oldIndex > -1) browserdata.saved.splice(oldIndex, 1);
						currentSetData.setId = serverSetId; currentSetData.isLocal = false; currentSetId = serverSetId;
						currentSetData.modified = response.modified || new Date().toISOString();
						saveCurrentSetToLocal(); // Save under new ID
						history.pushState({ setId: serverSetId }, document.title, `?setId=${serverSetId}`);
						showToast(`Set "${currentSetData.name}" saved online!`, 'success');
					} else { // Handle update response
						currentSetData.modified = response.modified || new Date().toISOString();
						currentSetData.isLocal = false;
						saveCurrentSetToLocal();
						showToast(`Set "${currentSetData.name}" updated successfully!`, 'success');
					}
					oldSetData = JSON.parse(JSON.stringify(currentSetData.data)); // Update baseline on success
				} else { throw new Error(response?.message || "Unknown server error during save."); }
			} catch (error) {
				console.error("Failed to save set to server:", error);
				showToast(`Server save failed: ${error.message}. Changes saved locally.`, 'error', 5000);
			} finally { hideLoading(); }
		} else if (!isUserLoggedIn() && (isExistingServerSet || isNewLocalSet)) {
			showLoginPrompt("save this set online");
			showToast(`Set "${currentSetData.name}" saved locally. Log in to sync online.`, 'info');
			oldSetData = JSON.parse(JSON.stringify(currentSetData.data)); // Update baseline even for local save
		} else { // Purely local save, no message needed unless for confirmation
			// showToast(`Set "${currentSetData.name}" saved locally.`, 'success');
			oldSetData = JSON.parse(JSON.stringify(currentSetData.data)); // Update baseline
		}
	}

	// Generates add/delete commits by comparing old/new card data
	function changeToCommitedFormat(oldData = [], newData = []) {
		console.log("Generating commits: Old count:", oldData.length, "New count:", newData.length);
		const commits = [];
		const createFlashcardId = (card) => (card ? `${card.question}|${card.answer}` : null);

		const oldDataIds = new Map(oldData.map(card => [createFlashcardId(card), card]).filter(([id]) => id !== null));
		const newDataIds = new Map(newData.map(card => [createFlashcardId(card), card]).filter(([id]) => id !== null));

		// Find Deletions
		for (const [oldId] of oldDataIds.entries()) {
			if (!newDataIds.has(oldId)) {
				commits.push({ action: 'delete', flashcard: oldId });
			}
		}
		// Find Additions
		for (const [newId] of newDataIds.entries()) {
			if (!oldDataIds.has(newId)) {
				commits.push({ action: 'add', flashcard: newId });
			}
		}
		console.log("Generated Commits:", commits);
		return commits;
	}

	// Updates the 'opened' timestamp locally
	function updateSetOpenedTimestamp() {
		if (!currentSetData || !currentSetData.setId) return;
		currentSetData.opened = new Date().toISOString();
		saveCurrentSetToLocal(); // Save immediately after updating timestamp
	}

	// --- Navigation / View Switching ---
	function switchView(viewId) {
		const targetView = viewId.toUpperCase();
		const targetPage = pages[targetView.toLowerCase()];
		if (!targetPage) { console.error("Invalid view requested:", viewId); return; }

		const activePage = document.querySelector('.page.active');
		if (activePage === targetPage) { console.log("Already on view:", targetView); return; }

		Object.values(pages).forEach(page => page.classList.remove('active'));
		targetPage.classList.add('active');
		const oldView = currentView;
		currentView = targetView;
		console.log(`Switched view from ${oldView} to ${currentView}`);

		renderCurrentView(); // Render the content of the newly activated view

		// Handle session start/stop for flashcards view
		if (oldView === 'FLASHCARDS' && currentView !== 'FLASHCARDS') trackStudySession();
		if (currentView === 'FLASHCARDS' && oldView !== 'FLASHCARDS') {
			sessionStartTime = Date.now(); LAST_INTERACTION = Date.now();
			console.log("Flashcard session started:", new Date(sessionStartTime).toLocaleTimeString());
		}
	}

	function renderCurrentView() {
		console.log("Rendering view:", currentView);
		switch (currentView) {
			case 'PREVIEW': renderPreviewPage(); break;
			case 'FLASHCARDS': renderFlashcardsPage(); break;
			case 'EDIT': renderEditPage(); break;
			case 'LOADING': /* Handled by overlay */ break;
			default: console.error("Unknown view state:", currentView);
		}
	}

	// --- Rendering Functions ---

	function renderPreviewPage() {
		if (!pages.preview) return; // Ensure page element exists
		if (!currentSetData) {
			// Show minimal error state if data loading failed completely
			showError("Cannot display set details."); // showError updates title/creator
			// Disable action buttons
			if (studyButton) studyButton.disabled = true;
			if (editButton) editButton.disabled = true;
			// Clear content areas maybe?
			if (flashcardListUl) flashcardListUl.innerHTML = '<li class="error-message">Failed to load card data.</li>';
			if (editorsListUl) editorsListUl.innerHTML = '';
			if (viewersListUl) viewersListUl.innerHTML = '';
			return;
		}

		console.log("Rendering Preview for:", currentSetData.name);
		setTitleEl.textContent = currentSetData.name || 'Unnamed Set';
		setCreatorEl.textContent = `by ${currentSetData.ownerName || 'Unknown'}`;
		setCreatorEl.dataset.ownerId = currentSetData.OwnerID || '';

		const userId = account_data?.userInfo?.sub || account_data?.serverInfo?.userId;
		const canEdit = currentSetData.isLocal || (userId && userId === currentSetData.OwnerID) || (userId && Array.isArray(currentSetData.editors) && currentSetData.editors.includes(userId));
		editButton.disabled = !canEdit;
		editButton.title = canEdit ? "Edit this set" : "Permission required to edit";
		studyButton.disabled = !(currentSetData.data && currentSetData.data.length > 0);
		studyButton.title = studyButton.disabled ? "Add cards before studying" : "Study this set";

		flashcardListUl.innerHTML = '';
		if (currentSetData.data && currentSetData.data.length > 0) {
			cardCountEl.textContent = currentSetData.data.length;
			currentSetData.data.forEach(card => {
				const li = document.createElement('li');
				li.innerHTML = `<div class="flashcard-q">${card.question || '[No Q]'}</div><div class="flashcard-a">${card.answer || '[No A]'}</div>`;
				flashcardListUl.appendChild(li);
			});
		} else {
			cardCountEl.textContent = 0;
			flashcardListUl.innerHTML = `<li>No flashcards yet. ${canEdit ? 'Click Edit to add some!' : ''}</li>`;
		}

		userAvgTimeEl.textContent = 'Not tracked yet'; // Placeholder
		communityAvgTimeEl.textContent = 'N/A'; // Placeholder
		detailsSetIdEl.textContent = currentSetData.setId || 'N/A (Local)';
		lastUpdatedEl.textContent = formatDate(currentSetData.modified);

		if (typeof currentSetData.editors === 'string') currentSetData.editors = currentSetData.editors.split(',').map(e => e.trim()).filter(Boolean); else if (!Array.isArray(currentSetData.editors)) currentSetData.editors = [];
		if (typeof currentSetData.viewers === 'string') currentSetData.viewers = currentSetData.viewers.split(',').map(e => e.trim()).filter(Boolean); else if (!Array.isArray(currentSetData.viewers)) currentSetData.viewers = [];
		populateUserList(editorsListUl, currentSetData.editors, currentSetData.OwnerID, currentSetData.ownerName, 'editors');
		populateUserList(viewersListUl, currentSetData.viewers, currentSetData.OwnerID, currentSetData.ownerName, 'viewers');

		if (!previewContent?.classList.contains('active')) switchTab('preview');
	}

	function populateUserList(listUl, usersData, ownerId, ownerName, type) {
		if (!listUl) return;
		listUl.innerHTML = '';
		let usersToShow = new Set();
		let ownerAdded = false;
		if (ownerId) {
			const ownerDisplayName = `${ownerName || ownerId} (Owner)`;
			listUl.appendChild(createUserListItem(ownerId, ownerDisplayName));
			usersToShow.add(ownerId);
			ownerAdded = true;
		}
		if (Array.isArray(usersData)) {
			usersData.forEach(userId => {
				if (userId && userId !== ownerId && !usersToShow.has(userId)) {
					listUl.appendChild(createUserListItem(userId, userId)); // TODO: Name lookup
					usersToShow.add(userId);
				}
			});
		}
		if (type === 'viewers') {
			const isPublic = usersData.includes('public') || (!ownerAdded && usersData.length === 0);
			if (isPublic) {
				const li = createUserListItem('public', 'Anyone'); li.classList.add('anyone');
				listUl.innerHTML = ''; listUl.appendChild(li); return;
			}
		}
		if (listUl.children.length === 0) {
			if (type === 'editors' && ownerAdded) { } // Only owner, already shown
			else if (type === 'viewers' && ownerAdded && usersData.length === 0) {
				const li = createUserListItem(ownerId, `${ownerName || ownerId} (Owner Only)`); li.classList.add('owner-only'); listUl.appendChild(li);
			} else { listUl.innerHTML = '<li>None specified</li>'; }
		}
	}

	function createUserListItem(userId, displayName) {
		let li = document.createElement('li'); li.textContent = displayName; li.dataset.userId = userId;
		if (userId && userId !== 'public') { li.addEventListener('click', () => handleUserClick(userId)); li.style.cursor = 'pointer'; }
		else { li.style.cursor = 'default'; }
		return li;
	}

	function renderFlashcardsPage() {
		if (!currentSetData || !currentSetData.data || currentSetData.data.length === 0) {
			showToast("No cards available to study!", "info"); switchView('PREVIEW'); return;
		}
		console.log("Rendering Flashcards Page");
		flashcardsSetTitle.textContent = currentSetData.name || 'Untitled Set';
		flashcardsSetCount.textContent = `(${currentSetData.data.length})`;
		card = currentSetData.data[0] || null;
		nextCard = currentSetData.data.length > 1 ? currentSetData.data[1] : null;
		isCardFlipped = false;
		renderCurrentCard(); // Renders content based on card/nextCard/isCardFlipped
		// updateFlashcardControlsText called within renderCurrentCard

		hideQuickView();
		flashcardOuter.classList.remove('known', 'forgot', 'flipped', 'animating');
		flashcardOuter.style.transition = 'none'; flashcardInner.style.transition = 'none';
		flashcardOuter.style.transform = 'translateX(0px) translateY(0px) rotate(0deg)';
		flashcardInner.style.transform = 'rotateY(0deg)';
		requestAnimationFrame(() => {
			setTimeout(() => {
				if (!flashcardInner || !flashcardOuter) return;
				flashcardInner.style.transition = `transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)`;
				flashcardOuter.style.transition = `transform ${SWIPE_ANIMATION_DURATION}s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.2s ease`;
			}, 50);
		});
		if (flashcardContainer) flashcardContainer.focus();

		const userId = account_data?.userInfo?.sub || account_data?.serverInfo?.userId;
		const canEdit = currentSetData.isLocal || (userId && userId === currentSetData.OwnerID) || (userId && Array.isArray(currentSetData.editors) && currentSetData.editors.includes(userId));
		flashcardsEditBtn.disabled = !canEdit;
		flashcardsEditBtn.style.display = canEdit ? 'inline-block' : 'none';
		flashcardsEditBtn.title = canEdit ? "Edit this set" : "Permission required";
	}

	function renderCurrentCard() {
		if (flashcardOuter) flashcardOuter.classList.remove('known', 'forgot'); // Clear swipe indicators
		hideQuickView();

		if (!card) { // End of set condition
			console.log("End of set reached.");
			flashcardFrontText.textContent = "Set Finished!";
			flashcardBackText.textContent = "Well done!";
			if (flashcardBehind) flashcardBehind.style.display = 'none';
			if (controlLeft) controlLeft.textContent = "-";
			if (controlRight) controlRight.textContent = "-";
			if (controlInfo) controlInfo.textContent = "Done";
			// Prevent further actions? Or allow going back/editing?
			return;
		}

		flashcardFrontText.textContent = card.question || '[No Question]';
		flashcardBackText.textContent = card.answer || '[No Answer]';

		if (flashcardBehind) {
			if (nextCard) {
				flashcardBehindText.textContent = nextCard.question || '[Next: No Q]';
				flashcardBehind.style.display = 'flex';
			} else { flashcardBehind.style.display = 'none'; }
		}

		if (controlInfo && currentSetData?.data) {
			const currentIndex = currentSetData.data.findIndex(c => c === card);
			controlInfo.textContent = currentIndex !== -1 ? `${currentIndex + 1} / ${currentSetData.data.length}` : `? / ${currentSetData.data.length}`;
		}

		if (flashcardOuter && flashcardInner) {
			flashcardOuter.classList.toggle('flipped', isCardFlipped);
			flashcardInner.style.transform = isCardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
		}

		if (isCardFlipped) { updateFlashcardControlsText("FLIP", "FORGOT"); }
		else { updateFlashcardControlsText("KNOWN", "FLIP"); }
	}

	function updateFlashcardControlsText(left, right) {
		if (controlLeft) controlLeft.textContent = left || 'KNOWN';
		if (controlRight) controlRight.textContent = right || 'FORGOT';
	}

	function renderEditPage() {
		if (!isUserLoggedIn()) { showLoginPrompt("edit this set"); switchView('PREVIEW'); return; }
		if (!currentSetData) { showError("Cannot edit: No set data loaded."); switchView('PREVIEW'); return; }
		if (!pages.edit || !editTextArea) return;

		console.log("Rendering Edit Page for:", currentSetData.name);
		oldSetData = JSON.parse(JSON.stringify(currentSetData.data || [])); // Store baseline
		editTextArea.value = formatCardDataForEdit(currentSetData);
		editTextArea.scrollTop = 0; editTextArea.focus();
	}

	function formatCardDataForEdit(setData) {
		if (!setData) return "";
		let text = (setData.name || 'Untitled Set') + '\n\n---\n';
		if (setData.data && setData.data.length > 0) {
			text += setData.data.map(card => {
				const q = (card.question || '').replace(/---/g, '- - -').trim();
				const a = (card.answer || '').replace(/---/g, '- - -').trim();
				return `${q}\n${a}`;
			}).join('\n---\n');
		} else { text = (setData.name || 'Untitled Set') + '\n'; }
		return text.trim();
	}

	function parseEditData(text) {
		const lines = text.trim().split('\n');
		const newSetData = { name: 'Untitled Set', data: [] };
		if (lines.length > 0 && lines[0].trim()) { newSetData.name = lines.shift().trim(); }
		const contentBlock = lines.join('\n');
		const cardBlocks = contentBlock.split(/^\s*---\s*$/gm);
		cardBlocks.forEach(block => {
			const trimmedBlock = block.trim(); if (!trimmedBlock) return;
			const blockLines = trimmedBlock.split('\n');
			const question = (blockLines.shift() || '').trim().replace(/- - -/g, '---');
			const answer = blockLines.join('\n').trim().replace(/- - -/g, '---');
			if (question || answer) { newSetData.data.push({ question, answer }); }
		});
		console.log("Parsed edit data:", newSetData);
		return newSetData;
	}


	// --- Event Listeners Setup ---
	function setupEventListeners() {
		// Preview Page
		if (previewHomeBtn) previewHomeBtn.addEventListener('click', () => { safeReplaceWrapper("Flow") });
		if (studyButton) studyButton.addEventListener('click', () => { if (!studyButton.disabled) switchView('FLASHCARDS'); });
		if (editButton) editButton.addEventListener('click', () => { if (isUserLoggedIn()) switchView('EDIT'); else showLoginPrompt("edit this set"); });
		if (tabNav) tabNav.addEventListener('click', (e) => { const btn = e.target.closest('.tab-button'); if (btn?.dataset.tab) switchTab(btn.dataset.tab); });
		if (setCreatorEl) setCreatorEl.addEventListener('click', () => { const id = setCreatorEl.dataset.ownerId; if (id) handleUserClick(id); });

		// Flashcards Page
		if (flashcardsBackBtn) flashcardsBackBtn.addEventListener('click', () => switchView('PREVIEW'));
		if (flashcardsEditBtn) flashcardsEditBtn.addEventListener('click', () => { if (isUserLoggedIn()) switchView('EDIT'); else showLoginPrompt("edit this set"); });
		if (flashcardContainer) { setupCardSwipe(); setupCardTap(); } // Separate tap setup
		document.addEventListener('keydown', handleFlashcardKeydown);

		// Edit Page
		if (editBackBtn) editBackBtn.addEventListener('click', () => { if (hasUnsavedChanges()) { if (confirm("Discard unsaved changes?")) switchView('PREVIEW'); } else switchView('PREVIEW'); });
		if (editSaveBtn) editSaveBtn.addEventListener('click', handleSaveFromEditor);

		// Global
		document.body.addEventListener('click', (e) => { if (isQuickViewVisible() && quickViewContainer && !quickViewContainer.contains(e.target) && (!flashcardContainer || !flashcardContainer.contains(e.target))) hideQuickView(); }, true);
	}

	// Separate Tap Setup for Clarity
	function setupCardTap() {
		let tapStartTime = 0, tapStartPos = { x: 0, y: 0 }, isDraggingForTapCheck = false;
		// REMOVED passive: true as a precaution
		flashcardContainer.addEventListener('pointerdown', (e) => {
			if (isQuickViewVisible() || flashcardOuter?.classList.contains('animating') || e.target.closest('#quick-view-list li')) return;
			isDraggingForTapCheck = false; tapStartTime = Date.now(); tapStartPos = { x: e.clientX, y: e.clientY };
		});
		// REMOVED passive: true as a precaution
		flashcardContainer.addEventListener('pointermove', (e) => {
			if (!isDraggingForTapCheck && tapStartTime > 0) { const dist = Math.hypot(e.clientX - tapStartPos.x, e.clientY - tapStartPos.y); if (dist > 10) { isDraggingForTapCheck = true; tapStartTime = 0; } }
		});
		flashcardContainer.addEventListener('pointerup', (e) => {
			if (tapStartTime > 0 && !isDraggingForTapCheck) { const dur = Date.now() - tapStartTime; if (dur < 250) handleCardFlip(); }
			isDraggingForTapCheck = false; tapStartTime = 0;
		});
	}


	// Sets up Pointer Event listeners for swipe gestures
	function setupCardSwipe() {
		console.log("Setting up card swipe listeners...");
		if (!flashcardContainer || !flashcardOuter || !flashcardInner) {
			console.error("Cannot setup swipe: Card elements not found.");
			return;
		}
		console.log("Setting up card swipe listeners on:", flashcardContainer); // Log setup

		let startX = 0, startY = 0, currentX = 0, currentY = 0, startTime = 0;
		let isDragging = false, didTriggerCopy = false, isHorizontalSwipe = null;
		let pointerId = null;

		const pointerDown = (e) => {
			console.log("%cPointer Down triggered:", "color: blue; font-weight: bold;", e.pointerId, e.target); // LOG 1

			// Check if the event target is inside the quick view list item
			if (e.target.closest('#quick-view-list li')) {
				console.log("  Pointer Down on quick view item, ignoring drag start.");
				return;
			}

			// LOG 2: Check guard clause conditions BEFORE the check
			console.log(`  Checking guards: isDragging=${isDragging}, isQuickView=${isQuickViewVisible()}, isAnimating=${flashcardOuter?.classList.contains('animating')}`);
			if (isDragging || isQuickViewVisible() || flashcardOuter?.classList.contains('animating')) {
				console.log("%c  Pointer Down Guard blocked execution.", "color: orange;"); // LOG 3
				return;
			}

			// LOG 4: Guards passed
			console.log("  Pointer Down Guards passed. Setting up drag...");

			isDragging = true;
			didTriggerCopy = false;
			isHorizontalSwipe = null;
			startX = e.clientX; startY = e.clientY;
			currentX = startX; currentY = startY;
			startTime = performance.now();
			pointerId = e.pointerId;

			if (!flashcardOuter || !flashcardInner) {
				console.error("  Cannot start drag: flashcardOuter or inner missing.");
				isDragging = false; // Abort
				return;
			}
			flashcardOuter.style.transition = 'none';
			flashcardInner.style.transition = 'none';
			flashcardOuter.classList.remove('known', 'forgot');

			try {
				flashcardContainer.setPointerCapture(pointerId);
				console.log("%c  Pointer captured:", "color: green;", pointerId); // LOG 6
				flashcardContainer.style.cursor = 'grabbing';
			} catch (error) {
				console.error("%c  Failed to capture pointer:", "color: red;", error); // LOG 7 (Error case)
				// Might still work without capture sometimes, but less reliably
			}
		};

		const pointerMove = (e) => {
			// LOG 8: Check if move handler is firing
			// console.log("Pointer Move event fired:", e.pointerId); // Reduce noise once confirmed

			// LOG 9: Check move conditions
			// console.log(`  Checking move: isDragging=${isDragging}, eventPID=${e.pointerId}, storedPID=${pointerId}`);
			if (!isDragging || e.pointerId !== pointerId) return;

			// LOG 10: Move check passed
			// console.log("  Move check PASSED.");

			currentX = e.clientX; currentY = e.clientY;
			const diffX = currentX - startX;
			const diffY = currentY - startY;

			// LOG 11: Calculated diffs
			console.log(`%c  MOVE: diffX=${diffX.toFixed(0)}, diffY=${diffY.toFixed(0)}`, "color: purple;");

			if (!flashcardOuter) {
				console.error("  Cannot move card: flashcardOuter missing in pointerMove.");
				return;
			}

			// Determine dominant swipe direction early
			if (isHorizontalSwipe === null && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
				isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY);
			}

			const containerWidth = flashcardContainer?.offsetWidth || window.innerWidth; // Use fallback
			const rotation = (diffX / containerWidth) * 15;
			const transformStyle = `translateX(${diffX}px) translateY(${diffY}px) rotate(${rotation}deg)`;

			// LOG 12: Log the style being applied
			console.log(`%c  Applying transform: ${transformStyle}`, "color: darkcyan;");

			// --- Apply the style ---
			flashcardOuter.style.transform = transformStyle;
			// -----------------------

			// Add visual cues based ONLY on horizontal direction
			if (isHorizontalSwipe) {
				flashcardOuter.classList.toggle('known', diffX < 0);
				flashcardOuter.classList.toggle('forgot', diffX > 0);
			} else {
				flashcardOuter.classList.remove('known', 'forgot');
			}

			// Check for vertical drag copy threshold
			const copyThresholdPixels = (flashcardContainer?.offsetHeight || window.innerHeight) * COPY_DRAG_THRESHOLD_RATIO;
			if (!isHorizontalSwipe && diffY > copyThresholdPixels && !isQuickViewVisible() && !didTriggerCopy) {
				console.log("  Threshold met for copy action.");
				renderQuickView(); didTriggerCopy = true;
			} else if (didTriggerCopy && diffY <= copyThresholdPixels - 20) {
				console.log("  Dragged back up, hiding copy action.");
				hideQuickView(); didTriggerCopy = false;
			}
		};

		const pointerEnd = (e) => {
			// LOG 1: Confirm function entry
			console.log("%cPointer End/Cancel triggered:", "color: red; font-weight: bold;", e.pointerId);

			// LOG 2: Check entry conditions
			console.log(`  Checking end conditions: isDragging=${isDragging}, eventPID=${e.pointerId}, storedPID=${pointerId}`);
			if (!isDragging || e.pointerId !== pointerId) {
				console.log("  Pointer End check FAILED, returning."); // LOG 3
				return; // Not the pointer we are tracking or not dragging
			}
			console.log("  Pointer End check PASSED."); // LOG 4

			// --- Immediate Cleanup ---
			isDragging = false; // Mark dragging as finished

			try {
				if (flashcardContainer && flashcardContainer.hasPointerCapture && flashcardContainer.hasPointerCapture(pointerId)) {
					flashcardContainer.releasePointerCapture(pointerId);
					console.log("  Pointer released:", pointerId);
				}
			} catch (error) {
				console.warn("  Could not release pointer capture:", error);
			}

			if (flashcardContainer) {
				flashcardContainer.style.cursor = 'grab'; // Reset cursor
			}
			// Ensure quick view related flag is reset if needed, although handled elsewhere too
			// didTriggerCopy = false; // Resetting here might be too early if snap back depends on it below

			// --- Handle Active Quick View ---
			// If Quick View (Copy) was triggered AND is still visible when pointer is released,
			// don't swipe the card away. Just snap it back visually.
			if (didTriggerCopy && isQuickViewVisible()) {
				console.log("%c  Quick View active, snapping card back instead of swiping.", "color: orange;");
				if (flashcardOuter) {
					flashcardOuter.style.transition = `transform 0.2s ease-out`; // Quick snap back
					flashcardOuter.style.transform = 'translateX(0px) translateY(0px) rotate(0deg)';
					flashcardOuter.classList.remove('known', 'forgot'); // Clear drag indicators
					// Reset transition after animation
					setTimeout(() => {
						if (!isDragging && flashcardOuter) flashcardOuter.style.transition = '';
					}, 200);
				}
				// Reset flags for next interaction
				isHorizontalSwipe = null;
				pointerId = null;
				didTriggerCopy = false; // Reset copy trigger flag now
				return; // Stop further swipe processing
			}
			// If quick view was triggered but hidden before pointer up, reset the flag
			if (didTriggerCopy && !isQuickViewVisible()) {
				didTriggerCopy = false;
			}


			// --- Calculate Swipe Metrics ---
			const diffX = currentX - startX;
			const diffY = currentY - startY; // Needed for targetY calculation if used
			const endTime = performance.now();
			const deltaTime = Math.max(10, endTime - startTime); // Avoid division by zero, ms
			const velocityX = diffX / deltaTime; // px/ms

			const cardWidth = flashcardContainer?.offsetWidth || window.innerWidth; // Use fallback
			const distanceThreshold = cardWidth * HORIZONTAL_SWIPE_THRESHOLD_RATIO;

			// --- Check Swipe Conditions ---
			const meetsVelocity = Math.abs(velocityX) > VELOCITY_THRESHOLD && deltaTime < MAX_FLICK_DURATION;
			const meetsDistance = Math.abs(diffX) > distanceThreshold;

			// LOG 5: Log swipe check values
			console.log(`  Swipe Check: isHorizontal=${isHorizontalSwipe}, meetsVel=${meetsVelocity}, meetsDist=${meetsDistance}, diffX=${diffX.toFixed(0)}, velX=${velocityX.toFixed(2)}`);

			// --- Decide Action: Swipe or Snap Back ---
			if (isHorizontalSwipe && (meetsVelocity || meetsDistance)) {
				// SWIPE ACTION
				console.log("%c  SWIPE detected, processing known/forgot.", "color: green; font-weight: bold;"); // LOG 6
				// Calculate projected endpoint for animation
				const targetX = Math.sign(diffX) * (cardWidth * 1.5); // Go well off screen
				// const targetY = diffY * 1.5; // Optional: project Y based on drag too
				const targetY = 0; // Simpler: Animate horizontally only

				// Trigger Known or Forgot based on direction and flip state
				if (diffX < 0) { // Swiped Left
					console.log("  Direction: Left (Known intent)");
					if (isCardFlipped) {
						console.log("    Card was flipped, flipping back first.");
						handleCardFlip(); // Flip back to front if needed before known action? Or just mark known? Mark known directly is simpler.
						// handleCardKnown(targetX, targetY); // Assume Known action applies regardless of flip state on left swipe
					} else {
						// Already on front, mark as known
						handleCardKnown(targetX, targetY);
					}
				} else { // Swiped Right
					console.log("  Direction: Right (Forgot intent)");
					if (!isCardFlipped) {
						console.log("    Card was not flipped, flipping first.");
						handleCardFlip(); // Flip to back if needed before forgot action? Or just mark forgot? Mark forgot directly is simpler.
						// handleCardForgot(targetX, targetY); // Assume Forgot action applies regardless of flip state on right swipe
					} else {
						// Already on back, mark as forgot
						handleCardForgot(targetX, targetY);
					}
				}
			} else {
				// SNAP BACK ACTION
				console.log("%c  NO SWIPE detected, should SNAP BACK.", "color: orange;"); // LOG 7
				console.log("  Executing Snap Back logic."); // LOG 8
				if (flashcardOuter) {
					flashcardOuter.style.transition = `transform 0.2s ease-out`; // Apply snap back transition
					flashcardOuter.style.transform = 'translateX(0px) translateY(0px) rotate(0deg)'; // Apply reset transform
					flashcardOuter.classList.remove('known', 'forgot'); // Clear drag indicator classes
					console.log("  Snap back transform and transition applied."); // LOG 9

					// Use setTimeout to reset the transition *after* the snap animation finishes
					// This prevents the *next* drag move from being animated by this transition
					setTimeout(() => {
						// Check element still exists and we are not dragging again immediately
						if (!isDragging && flashcardOuter) {
							flashcardOuter.style.transition = ''; // Remove inline transition, revert to CSS default
							console.log("  Snap back transition reset via timeout."); // LOG 10
						} else {
							console.log("  Snap back timeout: Skipping transition reset (isDragging true or element missing).");
						}
					}, 200); // Duration should match the snap-back transition duration
				} else {
					console.error("  Cannot snap back: flashcardOuter element missing!"); // LOG 11
				}
			}

			// --- Final Cleanup for Next Interaction ---
			isHorizontalSwipe = null;
			pointerId = null;
			// didTriggerCopy reset happens earlier if quick view was active, or if swipe occurred.
			// If only snap back occurred, reset it here.
			if (!didTriggerCopy) didTriggerCopy = false; // Ensure it's false if snap back happened

			console.log("  Pointer End processing finished."); // LOG 15
		};

		flashcardContainer.addEventListener('pointerdown', pointerDown);
		flashcardContainer.addEventListener('pointermove', pointerMove);
		flashcardContainer.addEventListener('pointerup', pointerEnd);
		flashcardContainer.addEventListener('pointercancel', pointerEnd);
	}


	// --- Interaction Logic ---
	function switchTab(tabId) { // tabId will be 'preview', 'stats', or 'permissions'
		if (!tabNav || !tabContentContainer) {
			console.error("switchTab cannot run: tabNav or tabContentContainer missing.");
			return;
		}

		console.log("Attempting to switch tab to:", tabId); // DEBUG

		// Deactivate all buttons & sections
		tabNav.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
		tabContentContainer.querySelectorAll('.tab-content-section').forEach(section => section.classList.remove('active'));

		// Activate selected button
		const activeButton = tabNav.querySelector(`.tab-button[data-tab="${tabId}"]`);
		if (activeButton) {
			activeButton.classList.add('active');
			console.log("Activated button:", activeButton); // DEBUG
		} else {
			console.warn(`Tab button for '${tabId}' not found.`); // DEBUG
		}

		// Activate selected content section using the ID derived from tabId
		const contentId = `${tabId}-content`; // Constructs 'preview-content', 'stats-content', 'permissions-content'
		const activeContent = tabContentContainer.querySelector(`#${contentId}`); // LOOKS FOR THE ID *INSIDE* tabContentContainer

		// ---------> Potential Problem Area <---------
		// const activeContent = document.getElementById(contentId); // Alternative: Select directly by ID globally

		if (activeContent) {
			activeContent.classList.add('active');
			console.log("Activated content section:", activeContent); // DEBUG
		} else {
			console.warn(`Tab content section with ID '${contentId}' not found within tabContentContainer.`); // DEBUG
			// Add extra debug if using global getElementById fails too
			// if (!document.getElementById(contentId)) {
			//     console.error(`Tab content section with ID '${contentId}' not found ANYWHERE in the document!`);
			// }
		}
	}

	function handleUserClick(userId) {
		console.log(`handleUserClick called with userId: ${userId}`); // DEBUG E
		if (!userId || userId === 'public') {
			console.log("handleUserClick returning: Invalid userId or 'public'."); // DEBUG F
			if (typeof showToast === 'function') showToast("Cannot view profile for this entry.", "info");
			return;
		}
		console.log(`Attempting navigation via safeReplaceWrapper for user: ${userId}`); // DEBUG G
		// Redirect to the profile page (use wrapper for safety)
		safeReplaceWrapper(`Flow/Profile/?userId=${userId}`); // Actual navigation happens here
	}

	function handleSaveFromEditor() {
		if (!isUserLoggedIn()) { showLoginPrompt("save changes"); return; }
		if (!currentSetData || !editTextArea) return;
		const parsedData = parseEditData(editTextArea.value);
		currentSetData.name = parsedData.name; currentSetData.data = parsedData.data;
		saveSetData().then(() => { switchView('PREVIEW'); }).catch(error => { showError("Save process failed: ", error); /* Stay on edit page? */ });
	}
	function hasUnsavedChanges() {
		if (currentView !== 'EDIT' || !currentSetData || !editTextArea) return false;
		return editTextArea.value.trim() !== formatCardDataForEdit(currentSetData).trim();
	}


	// --- Flashcard Interaction ---
	function handleCardFlip() {
		if (!card || flashcardOuter.classList.contains('animating') || isQuickViewVisible()) return;
		isCardFlipped = !isCardFlipped;
		flashcardOuter.classList.toggle('flipped', isCardFlipped);
		console.log("Card flipped state:", isCardFlipped);
		//Reset to center
		if (flashcardOuter) {
			flashcardOuter.style.transition = 'none'; // Disable transition for immediate effect
			flashcardOuter.style.transform = 'translateX(0px) translateY(0px) rotate(0deg)';
			flashcardOuter.classList.remove('known', 'forgot'); // Clear swipe indicators
		}
		if (flashcardInner) flashcardInner.style.transform = isCardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
		if (controlLeft) controlLeft.textContent = isCardFlipped ? "FLIP" : "KNOWN";
		if (controlRight) controlRight.textContent = isCardFlipped ? "FORGOT" : "FLIP";
		if (controlInfo) controlInfo.textContent = isCardFlipped ? "Back" : "Front";
		if (flashcardBehind) flashcardBehind.style.display = isCardFlipped ? 'none' : 'flex';
		if (flashcardBehindText) flashcardBehindText.textContent = nextCard ? nextCard.question || '[Next: No Q]' : '[No Next]';
		if (flashcardFrontText) flashcardFrontText.textContent = isCardFlipped ? card.answer || '[No Answer]' : card.question || '[No Question]';
		if (flashcardBackText) flashcardBackText.textContent = isCardFlipped ? card.question || '[No Question]' : card.answer || '[No Answer]';

		//Flashcard flip animation
		if (flashcardInner) flashcardInner.style.transition = `transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)`;
		if (flashcardOuter) flashcardOuter.style.transition = `transform ${SWIPE_ANIMATION_DURATION}s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.2s ease`;
		//if (flashcardOuter) flashcardOuter.style.transition = 'none'; // Disable transition for immediate effect
		renderCurrentCard(); // Update controls based on new state
	}
	function handleFlashcardKeydown(event) {
		if (currentView !== 'FLASHCARDS' || isQuickViewVisible() || flashcardOuter.classList.contains('animating') || event.metaKey || event.ctrlKey || event.altKey) return;
		let handled = false;
		switch (event.key) {
			case ' ': case 'Enter': case 'ArrowUp': handleCardFlip(); handled = true; break;
			case 'ArrowLeft': if (isCardFlipped) handleCardFlip(); else handleCardKnown(); handled = true; break;
			case 'ArrowRight': if (!isCardFlipped) handleCardFlip(); else handleCardForgot(); handled = true; break;
			case 'ArrowDown': if (!isQuickViewVisible()) renderQuickView(); handled = true; break;
			case 'Escape': if (isQuickViewVisible()) hideQuickView(); handled = true; break;
		}
		if (handled) event.preventDefault();
	}
	function handleCardKnown(targetX = -window.innerWidth, targetY = 0) {
		if (!card || flashcardOuter.classList.contains('animating')) return;
		flashcardOuter.classList.add('animating');
		const dismissedCard = card; const timeDelta = Date.now() - LAST_INTERACTION; LAST_INTERACTION = Date.now();
		console.log(`Card Known: ${dismissedCard.question} (dT: ${timeDelta}ms)`);
		let insertIndex; const len = currentSetData.data.length; if (len <= 1) insertIndex = 0; else { const maxT = 15000; const mapped = expMap(timeDelta, 0, maxT, len - 1, USER_MEMORY_LIMIT, USER_MEMORY_SCALE); insertIndex = Math.floor(mapped); const minI = Math.min(USER_MEMORY_LIMIT, len - 1); const maxI = len - 1; insertIndex = Math.max(minI, Math.min(insertIndex, maxI)); }
		animateCardSwipe(targetX, targetY, 'known', () => {
			const idx = currentSetData.data.findIndex(c => c === dismissedCard); if (idx === -1) { console.error("Known card lost"); proceedToNextCard(true); return; }
			currentSetData.data.splice(idx, 1); const adjIdx = Math.min(insertIndex, currentSetData.data.length); currentSetData.data.splice(adjIdx, 0, dismissedCard); proceedToNextCard(true);
		});
	}
	function handleCardForgot(targetX = window.innerWidth, targetY = 0) {
		if (!card || flashcardOuter.classList.contains('animating')) return;
		flashcardOuter.classList.add('animating');
		const dismissedCard = card; LAST_INTERACTION = Date.now();
		console.log(`Card Forgot: ${dismissedCard.question}`);
		let insertIndex; const len = currentSetData.data.length; if (len <= 1) insertIndex = 0; else { insertIndex = Math.max(0, Math.min(USER_MEMORY_LIMIT, len)); }
		animateCardSwipe(targetX, targetY, 'forgot', () => {
			const idx = currentSetData.data.findIndex(c => c === dismissedCard); if (idx === -1) { console.error("Forgot card lost"); proceedToNextCard(true); return; }
			currentSetData.data.splice(idx, 1); const adjIdx = Math.min(insertIndex, currentSetData.data.length); currentSetData.data.splice(adjIdx, 0, dismissedCard); proceedToNextCard(true);
		});
	}
	function animateCardSwipe(targetX, targetY, swipeClass, callback) {
		if (!flashcardOuter) return;
		flashcardOuter.classList.remove('known', 'forgot'); if (swipeClass) flashcardOuter.classList.add(swipeClass);
		flashcardOuter.style.transition = `transform ${SWIPE_ANIMATION_DURATION}s cubic-bezier(0.25, 0.8, 0.25, 1)`;
		const rot = (targetX / (window.innerWidth || 1000)) * 15; flashcardOuter.style.transform = `translateX(${targetX}px) translateY(${targetY}px) rotate(${rot}deg)`;
		setTimeout(() => { if (callback) { try { callback(); } catch (e) { console.error("Swipe callback error:", e); proceedToNextCard(true); } } else { proceedToNextCard(true); } }, SWIPE_ANIMATION_DURATION * 1000 + 10);
	}
	function proceedToNextCard(updateState = false) {
		console.log("Proceeding to next card. Update state:", updateState);
		if (updateState) {
			if (!currentSetData?.data) { card = null; nextCard = null; }
			else { card = currentSetData.data[0] || null; nextCard = currentSetData.data.length > 1 ? currentSetData.data[1] : null; }
			console.log("New current card:", card?.question);
		}
		if (flashcardOuter && flashcardInner) {
			flashcardOuter.style.transition = 'none'; flashcardInner.style.transition = 'none';
			flashcardOuter.style.transform = 'translateX(0px) translateY(0px) rotate(0deg)'; flashcardInner.style.transform = 'rotateY(0deg)';
			isCardFlipped = false; flashcardOuter.classList.remove('animating', 'known', 'forgot', 'flipped');
		} else { console.error("Cannot reset visuals: Card elements missing."); return; }
		renderCurrentCard(); // Render new content/state
		requestAnimationFrame(() => {
			setTimeout(() => {
				if (!flashcardInner || !flashcardOuter) return;
				flashcardInner.style.transition = `transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)`;
				flashcardOuter.style.transition = `transform ${SWIPE_ANIMATION_DURATION}s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.2s ease`;
			}, 30);
		});
	}

	// --- Quick View (Copy To) ---
	function renderQuickView() {
		if (!isUserLoggedIn()) { showLoginPrompt("copy cards"); return; } // Login check
		if (!quickViewList || !quickViewContainer) return;
		quickViewList.innerHTML = '';
		const availableSets = browserdata?.saved?.filter(set => set.setId !== currentSetData?.setId) || [];
		if (availableSets.length === 0) { quickViewList.innerHTML = '<li>No other local sets to copy to.</li>'; quickViewContainer.classList.add('visible'); return; }
		availableSets.forEach(set => {
			const li = document.createElement('li'); li.className = 'set-item'; li.dataset.targetSetId = set.setId;
			const color = set.color || (typeof textToColor === 'function' ? textToColor(set.name || '') : '#333');
			const textColor = typeof getContrastColor === 'function' ? getContrastColor(color) : '#fff';
			const count = Array.isArray(set.data) ? set.data.length : 0;
			li.innerHTML = `<div class="set-thumbnail" style="background-color: ${color}; color: ${textColor};">${count}</div><div class="set-details"><div class="set-title">${set.name || 'Untitled Set'}</div><div class="set-message">Tap to copy current card</div></div>`;
			li.addEventListener('click', (e) => { e.stopPropagation(); handleCopyToSet(set.setId); });
			quickViewList.appendChild(li);
		});
		quickViewContainer.classList.add('visible');
	}
	function handleCopyToSet(targetSetId) {
		if (!isUserLoggedIn()) { showLoginPrompt("copy cards"); hideQuickView(); return; } // Redundant check
		const cardToCopy = card; if (!cardToCopy) { showToast("Error: Cannot find card to copy.", "error"); hideQuickView(); return; }
		const targetSetIndex = browserdata.saved.findIndex(s => s.setId === targetSetId); if (targetSetIndex === -1) { showToast("Error: Target set not found.", "error"); hideQuickView(); return; }
		const targetSet = browserdata.saved[targetSetIndex]; if (!Array.isArray(targetSet.data)) targetSet.data = [];
		const alreadyExists = targetSet.data.some(c => c.question === cardToCopy.question && c.answer === cardToCopy.answer);
		if (alreadyExists) { showToast(`Card already exists in "${targetSet.name}".`, "info"); }
		else { targetSet.data.push(JSON.parse(JSON.stringify(cardToCopy))); targetSet.modified = new Date().toISOString(); targetSet.opened = new Date().toISOString(); saveBrowserAndAccountDataWrapper(browserdata, account_data); showToast(`Card copied to "${targetSet.name}"!`, 'success'); }
		hideQuickView();
	}
	function isQuickViewVisible() { return quickViewContainer?.classList.contains('visible'); }
	function hideQuickView() { quickViewContainer?.classList.remove('visible'); }


	// --- Study Time Tracking ---
	function trackStudySession() {
		if (currentView !== 'FLASHCARDS' || !sessionStartTime) return;
		const sessionEndTime = Date.now(); const durationSeconds = Math.round((sessionEndTime - sessionStartTime) / 1000);
		console.log(`Attempting track study session. Duration: ${durationSeconds}s.`);
		if (durationSeconds < 5) { console.log("Session too short, not tracking."); sessionStartTime = null; return; }

		const canTrackStreak = typeof addToStreakToday === 'function'; const canSaveData = typeof saveBrowserAndAccountData === 'function';
		if (!canSaveData) { console.error("Cannot track session: save function missing."); showToast("Error saving session progress.", "error"); sessionStartTime = null; return; }

		try { if (canTrackStreak) addToStreakToday(browserdata, sessionStartTime, durationSeconds); saveBrowserAndAccountDataWrapper(browserdata, account_data); console.log(`Study session tracked (${durationSeconds}s) and saved.`); }
		catch (error) { console.error("Error tracking study session:", error); showToast("Error saving study progress.", "error"); }
		finally { sessionStartTime = null; console.log("Session start time reset."); }
	}


	// --- Utility Function: Exponential Mapping ---
	function expMap(value, inMin, inMax, outMin, outMax, scale = 1) {
		value = Math.max(inMin, Math.min(value, inMax)); const norm = (inMax - inMin === 0) ? 0 : (value - inMin) / (inMax - inMin); const scaled = Math.pow(norm, scale); return outMin + (outMax - outMin) * scaled;
	}

	// --- Start The Application ---
	init();

}); // End DOMContentLoaded