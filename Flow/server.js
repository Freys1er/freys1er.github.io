async function doGet(token, action, data = "") {
    const API_URL = "https://script.google.com/macros/s/AKfycbz1MPkZ0g0JjExBxpLZkzBOWqJ4-P1kHvFl3SaUf7zNJlNSEvs_DAy1QgCr-yrrtyrD/exec"; // Replace with your actual deployment URL

    // Construct the payload
    const payload = {
        action: action,
        data: data
    };

    // Serialize the payload and token into URL query parameters
    const queryParams = new URLSearchParams({
        token: token,
        payload: JSON.stringify(payload)
    });

    console.log(payload)

    try {
        // Send the GET request to the server
        const response = await fetch(`${API_URL}?${queryParams.toString()}`);

        // Parse and handle the JSON response
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();

        console.log(result)

        if (result.message && result.message.includes("invalid_token")) {
            //safeReplace("Google/?redirect=Flow")
        }
        return result;

    } catch (error) {
        console.error("Error communicating with the server:", error);
        throw error;
    }
}

function safeReplace(newDir) {
    const parsedURL = new URL(window.location.href);

    let baseURL = `${parsedURL.protocol}//${parsedURL.hostname}`;
    if (parsedURL.port) baseURL += `:${parsedURL.port}`;

    const hivePath = "/Hive";
    const hiveIndex = parsedURL.pathname.indexOf(hivePath);
    if (hiveIndex !== -1) {
        baseURL += parsedURL.pathname.slice(0, hiveIndex + hivePath.length);
    }

    const newUrl = `${baseURL}/${newDir}`;
    if (window.location.href !== newUrl) {
        console.log("Redirecting to:", newUrl);
        window.location.href = newUrl;
    }
}