# Server Communication Guide for Frontend Developers
This guide explains how to send instructions (we call them "actions") to the server and what kind of information you can expect back.

Base URL: (This is the web address where your server lives. Ask the backend team for this!)

## How to Send Instructions:

You'll send instructions to the server by adding special information to the end of the server's web address. These special pieces of information are called "parameters."

## The main parameters you'll need to include are:

**token:**

Think of this like your secret digital handshake. It proves to the server that it's really you making the request.
You usually get this after you log in using your Google account.
Important! You need to send this with every single request you make to the server. If the server doesn't see your token, it won't know who you are and might not let you do anything.
How to send it: You'll add it to the end of the server's address like this: ?token=YOUR_SECRET_TOKEN. Replace YOUR_SECRET_TOKEN with the actual token you have.
payload:

This is like a wrapped-up package that tells the server exactly what you want it to do and includes any extra details it might need.
This package needs to be in a special format called JSON. JSON looks like a list of things with names and values, kind of like a recipe with ingredients and amounts. It uses curly braces {} and square brackets [].
Inside the payload, there will usually be at least one important thing:
action: This is like the name of the recipe – it tells the server what you want to do (like "get my info," "create a new thing," etc.).
Sometimes, there will also be a data part inside the payload. This is like the ingredients for your recipe – it gives the server the specific information it needs for that action.
How to send it: Just like the token, you add the payload as a parameter in the web address. But since the payload is usually a JSON thing with special characters, you need to make it safe to send in a web address. Your code will usually handle this for you (it's called "encoding"). It will look something like this: &payload={"action": "getUserData"}. Notice the & because we're adding another parameter after the token. If there's extra information needed for the action, it goes inside the {} after "data":. For example: &payload={"action": "updateUser", "data": {"username": "MyNewName"}}.
Example Request (how it might look in your code):

JavaScript

server(user's google token, action, data)

## Here's a detailed look at each of the things you can ask the server to do:

**getUserData:**

What to Send in payload.data? Nothing! For this action, the server just needs your token to know who you are.
What to Expect Back? The server will send back a JSON response that looks something like this:
JSON

{
  "status": "success", // This means everything went okay!
  "message": "User data retrieved successfully.", // A little note explaining what happened
  "userData": {
    // Your user information will be here, like your username, maybe your score, etc.
    "username": "CoolCoder123",
    "points": 500
  },
  "googleData": {
    // Information about your Google account that the server knows
    "sub": "yourUniqueGoogleId",
    "email": "your.email@example.com"
  }
}
OR, if you're not registered yet, it might send this:
JSON

{
  "status": "ok", // It's "ok" because there wasn't an error, just you're new!
  "message": "User not registered.",
  "userData": null, // No user data to send back
  "googleData": {
    "sub": "yourUniqueGoogleId",
    "email": "your.email@example.com"
  }
}
**createUser:**

What to Send in payload.data? You need to send a username you want to use. It will look like this:
JSON

{
  "username": "yourCoolName"
}
What to Expect Back? If everything goes well, you'll get something like:
JSON

{
  "status": "success",
  "message": "User created successfully.",
  "userData": {
    "username": "yourCoolName",
    // Other initial user info might be here
  }
}
If something goes wrong (like the username is already taken), you'll get an error message in the status and message.
**updateUser:**

What to Send in payload.data? You send the information you want to change. For example, to change your username:
JSON

{
  "username": "MyNewName"
}
You can send multiple things to update at once too:
JSON

{
  "username": "MyNewName",
  "favoriteColor": "blue"
}
What to Expect Back? If the update is successful:
JSON

{
  "status": "success",
  "message": "User data updated successfully.",
  "userData": {
    "username": "MyNewName",
    "points": 500,
    "favoriteColor": "blue"
    // ... other user info ...
  }
}
You might get an error if something goes wrong with the update.
**getSet:**

What to Send in payload.data? You need to tell the server which set of information you want by sending its unique ID:
JSON

{
  "setId": "theUniqueIdOfTheSet"
}
What to Expect Back? If the server finds the set:
JSON

{
  "status": "success",
  "message": "Set data retrieved successfully.",
  "setData": {
    "id": "theUniqueIdOfTheSet",
    "name": "Important Facts",
    //---------------------------------------------------------------
  }
}
If the set isn't found, you'll likely get an error message.
**getUserSets:**

What to Send in payload.data? You need to tell the server whose sets you want to see. Usually, this will be your own Google ID:
JSON

{
  "ownerId": "theGoogleUserId"
}
What to Expect Back? You'll get a list of all the sets created by that user:
JSON

{
  "status": "success",
  "message": "User sets retrieved successfully.",
  //----------------------------------------------------------------------------
}
You might get an error if there's a problem finding the sets.
**updateSet:**

What to Send in payload.data? This one is a bit more complex. You need to tell the server:
setId: Which set you want to change.
action: What you want to do ("add" something, "edit" something, or "delete" something).
data: The actual information you want to add, edit, or delete. The format of this data will depend on the action. For example, to add a new flashcard:
JSON

{
  "setId": "theSetToUpdate",
  "action": {
    "type": "add",
    "flashcard": "question|answer"
  }
}
To replace an existing item:
JSON

{
  "setId": "theSetToUpdate",
  "action": "File"
}
To delete an item (again, you might need its ID):
JSON

{
  "setId": "theSetToUpdate",
  "action": "File"
}

What to Expect Back? If the update is successful:
JSON

{
  "status": "success",
  "message": "Set data updated successfully.",
  "setData": {
    "id": "theSetToUpdate",
    "name": "Important Facts",
    "items": [
      // ... the updated list of items ...
    ]
  }
}
You'll get an error message if something goes wrong with the update.
**searchSet:**

What to Send in payload.data? You need to send the query (the words you're searching for):
JSON

{
  "query": "science facts"
}
What to Expect Back? You'll get a list of sets that match your search:
JSON

{
  "status": "success",
  "message": "Search results retrieved successfully.",
  "searchResults": [
    { "id": "science1", "name": "Cool Science Stuff", "description": "Fun science facts" },
    { "id": "science2", "name": "More Science!", "description": "Even more interesting science" }
    // ... matching sets ...
  ]
}
If no sets match, the searchResults might be an empty list [].
**getBalance:**

What to Send in payload.data? Nothing! The server uses your token to figure out your balance.
What to Expect Back? You'll get your current balance:
JSON

{
  "status": "success",
  "message": "Balance retrieved successfully.",
  "balance": 123.45 // Your balance as a number
}
You might get an error if there's a problem getting your balance.
**makeTransaction:**

What to Send in payload.data? You need to provide details about the transaction:
JSON

{
  "to": "recipientUserId", // The ID of the person you're sending to
  "amount": 10,           // The amount you're sending
  "memo": "Birthday gift"   // An optional note
}
What to Expect Back? If the transaction is successful:
JSON

{
  "status": "success",
  "message": "Transaction successful.",
  "transactionDetails": {
    "from": "yourUserId",
    "to": "recipientUserId",
    "amount": 10,
    "memo": "Birthday gift",
    "timestamp": "2023-10-27T10:00:00Z"
  }
}
You'll get an error if the transaction fails (like if you don't have enough balance). Important Note: We might use a different way to send this kind of request in the future, so keep an eye out for updates!
getTransactionHistory:

What to Send in payload.data? Nothing! The server uses your token to get your transaction history.
What to Expect Back? You'll get a list of your past transactions:
JSON

{
  "status": "success",
  "message": "Transaction history retrieved successfully.",
  "history": [
    { "type": "sent", "to": "userX", "amount": 5, "memo": "Lunch" },
    { "type": "received", "from": "userY", "amount": 10, "memo": "Payment" }
    // ... more transactions ...
  ]
}
If you haven't made any transactions, the history might be an empty list [].
**redeemGiftCard:**

What to Send in payload.data? You need to send the ID of the gift card:
JSON

{
  "giftCardId": "theGiftCardCode"
}
What to Expect Back? If the gift card is valid and hasn't been used:
JSON

{
  "status": "success",
  "message": "Gift card redeemed successfully."
}
You'll get an error if the gift card is invalid or already used.
What to Expect in the Server's Response (General):

Every time you send a request, the server will reply with a JSON response. This response will usually have at least these things:

status: Tells you if your request was successful. Usually "success" or "ok" means it worked, and something else (like "error") means there was a problem.
message: A human-friendly explanation of what happened. This is super helpful if something goes wrong!
data: This is where the actual information you asked for will be. It could be your user details, a list of sets, or nothing at all (null).
Sometimes, the server might send back extra information too, like the googleData in the getUserData response.
Important Reminders:

Always include your token! It's your key to using the server.
Make sure your payload is always in the correct JSON format. If it's not, the server might get confused.
Always check the status in the server's response to see if your request did what you expected.
Read the message if there's an error – it will often tell you why.
The information you get back in the data part will be different depending on the action you asked for. Look at the descriptions for each action to know what to expect.
If you ever get stuck or have questions about how to use these actions, don't hesitate to ask the backend team for help! They're the experts on the server!