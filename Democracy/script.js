
// Example Poll Data Objects (Simulated Server Response)

const pollData_Buttons = {
    id: "poll1",
    question: "Which frontend framework do you prefer?",
    userInfo: { username: "FrameworkFan", avatar: "placeholder-avatar.png", timestamp: "2 Hours Ago" },
    options: [ // Contains one object describing the options block
        {
            type: "buttons", // Indicates multiple buttons
            choices: ["React", "Vue", "Svelte", "Angular"] // The button labels
        }
    ]
};

const pollData_List = {
    id: "poll2",
    question: "Select your primary cloud provider:",
    userInfo: { username: "CloudGuru", avatar: "placeholder-avatar.png", timestamp: "1 Day Ago" },
    options: [
        {
            type: "list", // Indicates a dropdown/select list
            choices: ["AWS", "Google Cloud", "Microsoft Azure", "Oracle Cloud", "DigitalOcean", "Heroku", "Vercel", "Netlify", "Other"]
        }
    ]
};

const pollData_Date = {
    id: "poll3",
    question: "Select your preferred event date:",
    userInfo: { username: "EventPlanner", avatar: "placeholder-avatar.png", timestamp: "3 Hours Ago" },
    options: [
        {
            type: "date" // Indicates a date input
            // Optional: Add min/max date attributes here if needed
            // min: "2024-08-01",
            // max: "2024-12-31"
        }
    ]
};

const pollData_YesNo = {
    id: "poll4",
    question: "Are you attending the team sync?",
    userInfo: { username: "TeamLead", avatar: "placeholder-avatar.png", timestamp: "15 Mins Ago" },
    options: [
        {
            type: "buttons",
            choices: ["Yes", "No"]
        }
    ]
};

const pollData_Number = {
    id: "poll5",
    question: "Rate this feature (1-5):",
    userInfo: { username: "UX Tester", avatar: "placeholder-avatar.png", timestamp: "5 Hours Ago" },
    options: [
        {
            type: "number",
            min: 1,
            max: 5,
            step: 1
        }
    ]
};


document.addEventListener('DOMContentLoaded', () => {
    const pollContainer = document.getElementById('poll-container');
    // --- Simulated Poll Data (Replace with actual fetch) ---
    const polls = [pollData_Buttons, pollData_List, pollData_Date, pollData_Number, pollData_YesNo];
    console.log(polls);
    // --- End Simulation ---

    // Function to render a single poll card
    function renderPollCard(pollData) {
        const card = document.createElement('div');
        card.classList.add('poll-card');
        card.dataset.pollId = pollData.id; // Store poll ID on the element

        // Header
        const header = document.createElement('div');
        header.classList.add('poll-header');
        header.innerHTML = `
            <div class="user-info">
                <img src="${pollData.userInfo.avatar || 'placeholder-avatar.png'}" alt="User Avatar" class="avatar">
                <span class="username">${pollData.userInfo.username || 'Anonymous'}</span>
            </div>
            <span class="timestamp">${pollData.userInfo.timestamp || ''}</span>
        `;

        // Question
        const questionContainer = document.createElement('div');
        questionContainer.classList.add('poll-question-container');
        questionContainer.innerHTML = `<h2 class="poll-question">${pollData.question || 'No question provided.'}</h2>`;

        // Voting Options (Dynamic Part)
        const optionsContainer = document.createElement('div');
        optionsContainer.classList.add('voting-options');
        renderVotingOptions(optionsContainer, pollData.options || []); // Pass options array

        // Actions (Comment/Report)
        const actions = document.createElement('div');
        actions.classList.add('poll-actions');
        actions.innerHTML = `
            <button class="action-btn comment-btn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"></path></svg>
                Comment
            </button>
            <button class="action-btn report-btn">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg>
                 Report
            </button>
        `;

        // Append parts to card
        card.appendChild(header);
        card.appendChild(questionContainer);
        card.appendChild(optionsContainer);
        card.appendChild(actions);

        return card;
    }

    // Function to render the specific voting UI based on type
    function renderVotingOptions(container, optionsDataArray) {
        container.innerHTML = ''; // Clear existing
        let needsSubmitButton = false; // Flag to add submit button for inputs/select

        if (!optionsDataArray || optionsDataArray.length === 0) {
            container.textContent = "No voting options available.";
            return;
        }

        // Assuming only one options object per poll for simplicity now
        const optionsConfig = optionsDataArray[0];

        switch (optionsConfig.type) {
            case 'buttons':
                optionsConfig.choices.forEach(choice => {
                    const button = document.createElement('button');
                    button.classList.add('vote-option-btn');
                    button.textContent = choice;
                    button.dataset.voteValue = choice; // Store value
                    container.appendChild(button);
                });
                break;

            case 'list':
                needsSubmitButton = true;
                const select = document.createElement('select');
                select.classList.add('vote-option-select');
                select.innerHTML = `<option value="" disabled selected>Select an option...</option>`; // Placeholder
                optionsConfig.choices.forEach(choice => {
                    const option = document.createElement('option');
                    option.value = choice;
                    option.textContent = choice;
                    select.appendChild(option);
                });
                container.appendChild(select);
                break;

            case 'date':
                needsSubmitButton = true;
                const dateInput = document.createElement('input');
                dateInput.type = 'date';
                dateInput.classList.add('vote-option-date');
                if (optionsConfig.min) dateInput.min = optionsConfig.min;
                if (optionsConfig.max) dateInput.max = optionsConfig.max;
                container.appendChild(dateInput);
                break;

            case 'number':
                needsSubmitButton = true;
                const numberInput = document.createElement('input');
                numberInput.type = 'number';
                numberInput.classList.add('vote-option-number');
                numberInput.placeholder = `(${optionsConfig.min || 'min'} - ${optionsConfig.max || 'max'})`; // Placeholder hint
                if (optionsConfig.min !== undefined) numberInput.min = optionsConfig.min;
                if (optionsConfig.max !== undefined) numberInput.max = optionsConfig.max;
                if (optionsConfig.step !== undefined) numberInput.step = optionsConfig.step;
                container.appendChild(numberInput);
                break;

            default:
                container.textContent = `Unsupported option type: ${optionsConfig.type}`;
        }

        // Add a submit button if needed for non-button types
        if (needsSubmitButton) {
            const submitBtn = document.createElement('button');
            submitBtn.classList.add('vote-submit-btn');
            submitBtn.textContent = 'Submit Vote';
            container.appendChild(submitBtn);
        }
    }

    // Function to handle vote submission
    function submitVote(pollId, value) {
        console.log(`Submitting Vote - Poll ID: ${pollId}, Value: ${value}`);
        // --- Replace with your actual API call ---
        // server(USER_TOKEN, 'submitVote', { pollId: pollId, vote: value })
        //  .then(response => {
        //      if (response.success) { console.log("Vote submitted successfully"); /* Update UI */ }
        //      else { console.error("Vote failed:", response.message); /* Show error */ }
        //  })
        //  .catch(error => { console.error("Error submitting vote:", error); });
        // --- End API call ---

        // Optional: Disable options after voting
        const pollCard = pollContainer.querySelector(`.poll-card[data-poll-id="${pollId}"]`);
        if (pollCard) {
            const optionsArea = pollCard.querySelector('.voting-options');
            optionsArea.querySelectorAll('button, input, select').forEach(el => el.disabled = true);
            const submitBtn = optionsArea.querySelector('.vote-submit-btn');
            if (submitBtn) submitBtn.textContent = "Voted";
            // Highlight selected button if applicable
            const selectedBtn = optionsArea.querySelector(`.vote-option-btn[data-vote-value="${value}"]`);
            if (selectedBtn) selectedBtn.classList.add('selected');
        }
    }


    // --- Main Execution ---

    // Clear placeholder
    pollContainer.innerHTML = '';

    // Render all polls from the simulated data
    polls.forEach(poll => {
        const pollCardElement = renderPollCard(poll);
        pollContainer.appendChild(pollCardElement);
    });


    // --- Global Event Listener for Actions ---
    pollContainer.addEventListener('click', (event) => {
        const target = event.target;
        const pollCard = target.closest('.poll-card');
        if (!pollCard) return; // Click was outside a poll card

        const pollId = pollCard.dataset.pollId;

        // --- Handle Button Votes ---
        if (target.classList.contains('vote-option-btn') && !target.disabled) {
            const voteValue = target.dataset.voteValue;
            submitVote(pollId, voteValue);
        }

        // --- Handle Submit Button for Inputs/Select ---
        else if (target.classList.contains('vote-submit-btn') && !target.disabled) {
            const optionsArea = target.closest('.voting-options');
            const inputElement = optionsArea.querySelector('select, input[type="date"], input[type="number"]');
            if (inputElement && inputElement.value) {
                // Basic validation for number input ranges
                if (inputElement.type === 'number') {
                    const numValue = parseFloat(inputElement.value);
                    const min = parseFloat(inputElement.min);
                    const max = parseFloat(inputElement.max);
                    if ((!isNaN(min) && numValue < min) || (!isNaN(max) && numValue > max)) {
                        alert(`Please enter a number between ${inputElement.min || 'min'} and ${inputElement.max || 'max'}.`);
                        return; // Stop submission
                    }
                }
                submitVote(pollId, inputElement.value);
            } else {
                alert("Please select or enter a value before submitting."); // Basic feedback
            }
        }

        // --- Handle Comment/Report Buttons ---
        else if (target.closest('.comment-btn')) {
            console.log("Comment button clicked for poll:", pollId);
        } else if (target.closest('.report-btn')) {
            console.log("Report button clicked for poll:", pollId);
        }
    });

}); // End DOMContentLoaded