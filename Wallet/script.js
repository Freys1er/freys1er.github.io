document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const balanceAmountElement = document.getElementById('balance-amount');
    const recipientInput = document.getElementById('recipient');
    const amountInput = document.getElementById('amount');
    const memoInput = document.getElementById('memo');
    const sendPaymentBtn = document.getElementById('send-payment-btn');
    const paymentStatusElement = document.getElementById('payment-status');
    const transactionListElement = document.getElementById('transaction-list');
    const refreshBalanceBtn = document.getElementById('refresh-balance-btn');
    const refreshHistoryBtn = document.getElementById('refresh-history-btn');

    // --- Configuration ---
    // WARNING: Hardcoding tokens is insecure! Use a proper authentication flow.

    //make a variable for account data, then set token

    const accountData = JSON.parse(localStorage.getItem("account_data"));
    const welcomeElement = document.getElementById('welcome-message');
    if (accountData && accountData.userInfo && accountData.userInfo.name) {
        welcomeElement.textContent = `Welcome, ${accountData.userInfo.name}`;
    } else {
        welcomeElement.textContent = 'Welcome!';
    }

    const USER_TOKEN = accountData.token;
    console.log(USER_TOKEN)


    // --- Functions ---
    function displayMessage(element, message, isError = false) {
        element.textContent = message;
        element.className = 'status-message'; // Reset classes
        if (message) {
            element.classList.add(isError ? 'error' : 'success');
        }
    }

    function updateBalanceUI(balance) {
        if (typeof balance === 'number') {
            balanceAmountElement.textContent = `$${balance.toFixed(2)}`;
        } else {
            balanceAmountElement.textContent = balance; // Display text like 'Error'
        }
    }

    async function fetchBalance() {
        updateBalanceUI('Loading...');
        try {
            const response = await server(USER_TOKEN, 'getBalance', {});
            if (response.success) {
                updateBalanceUI(response.balance);
            } else {
                updateBalanceUI('Error');
                console.error('Failed to fetch balance:', response.message);
                // Optionally display error near balance
            }
        } catch (error) {
            updateBalanceUI('Error');
            console.error('Error calling server for balance:', error);
        }
    }

    function displayHistory(history) {
        transactionListElement.innerHTML = ''; // Clear previous list
    
        if (!history || history.length === 0) {
            transactionListElement.innerHTML = '<li class="loading">No transactions found.</li>';
            return;
        }
    
        // Data is assumed to be sorted newest first by the server
        history.forEach(tx => {
            const li = document.createElement('li');
            const date = new Date(tx.timestamp);
            // Consider more user-friendly date formatting if needed
            const formattedDate = date.toLocaleString();
    
            const amountClass = tx.type === 'sent' ? 'sent' : 'received';
            const sign = tx.type === 'sent' ? '-' : '+';
            const peer = tx.type === 'sent' ? `To: ${tx.to || 'N/A'}` : `From: ${tx.from || 'N/A'}`;
    
            li.innerHTML = `
                <span class="tx-details">${peer}</span>
                <span class="tx-amount ${amountClass}">${sign}$${tx.amount.toFixed(2)}</span>
                ${tx.memo ? `<span class="tx-memo">Memo: ${tx.memo}</span>` : ''}
                 <span class="tx-timestamp">${formattedDate}</span>
            `;
            // *** CHANGE: Use prepend instead of appendChild ***
            transactionListElement.prepend(li);
        });
    
        // No automatic scrolling needed usually, as newest items are at the top.
        // You could explicitly scroll to the top if desired:
        // transactionListElement.scrollTop = 0;
    }

    async function fetchHistory() {
        transactionListElement.innerHTML = '<li class="loading">Loading history...</li>';
        try {
            const response = await server(USER_TOKEN, 'getTransactionHistory', {});
            if (response.success) {
                displayHistory(response.history);
            } else {
                transactionListElement.innerHTML = '<li class="loading error">Failed to load history.</li>';
                console.error('Failed to fetch history:', response.message);
            }
        } catch (error) {
            transactionListElement.innerHTML = '<li class="loading error">Error loading history.</li>';
            console.error('Error calling server for history:', error);
        }
    }


    // In script.js

    // ... (keep other code like DOM elements, server function, etc.) ...

    async function handleSendPayment() {
        const recipient = recipientInput.value.trim();
        const amount = parseFloat(amountInput.value);
        const memo = memoInput.value.trim();

        // --- Basic Validation ---
        displayMessage(paymentStatusElement, '', false); // Clear previous messages
        if (!recipient) {
            displayMessage(paymentStatusElement, 'Please enter a recipient.', true);
            recipientInput.focus(); // Focus on the input field
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            displayMessage(paymentStatusElement, 'Please enter a valid positive amount.', true);
            amountInput.focus();
            return;
        }

        // --- Confirmation Step ---
        const amountFormatted = amount.toFixed(2);
        let confirmationMessage = `Confirm sending $${amountFormatted} to ${recipient}?`;
        if (memo) {
            confirmationMessage += `\nMemo: ${memo}`;
        }

        // Use the browser's built-in confirm dialog
        if (confirm(confirmationMessage)) {
            // --- User Confirmed ---
            displayMessage(paymentStatusElement, 'Processing payment...');
            sendPaymentBtn.disabled = true; // Disable button during processing

            try {
                const transactionData = {
                    to: recipient,
                    amount: amount,
                    memo: memo
                };

                const response = await server(USER_TOKEN, 'makeTransaction', transactionData); // Assumes USER_TOKEN is defined

                if (response.success) {
                    displayMessage(paymentStatusElement, response.message || 'Payment successful!', false);
                    // Clear form
                    recipientInput.value = '';
                    amountInput.value = '';
                    memoInput.value = '';
                    // Refresh balance and history
                    fetchBalance();
                    fetchHistory();
                } else {
                    // Display specific error from server if available
                    displayMessage(paymentStatusElement, response.message || 'Payment failed.', true);
                }
            } catch (error) {
                console.error('Error calling server for transaction:', error);
                displayMessage(paymentStatusElement, 'An error occurred while sending payment.', true);
            } finally {
                sendPaymentBtn.disabled = false; // Re-enable button regardless of outcome
            }
        } else {
            // --- User Cancelled ---
            displayMessage(paymentStatusElement, 'Payment cancelled.', false);
            console.log('User cancelled payment.');
        }
    }

    // ... (keep other functions like fetchBalance, displayHistory, event listeners, etc.) ...

    // --- Event Listeners ---
    sendPaymentBtn.addEventListener('click', handleSendPayment);
    refreshBalanceBtn.addEventListener('click', fetchBalance);
    refreshHistoryBtn.addEventListener('click', fetchHistory);

    // --- Initial Load ---
    fetchBalance();
    fetchHistory();
});

