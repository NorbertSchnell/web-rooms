# Web Rooms
*Web Rooms* is a generic general purpose websocket server that provides a simple set of commands to build creative cooperative applications.

## 1 Examples

- [Hello World!](https://norbertschnell.github.io/web-rooms/hello-world/)
- [Touch Touch](https://norbertschnell.github.io/web-rooms/touch-touch/)
- [Quizzy](https://norbertschnell.github.io/web-rooms/quizzy/)

## 2 Getting Started
To start developing your own rooms you may begin with modifying one of the examples. 
The most simple example is *hello-world*. The example 

You simply have to follow these steps:
1. Download the code from the GitHub repository either by cloning the repository or by downloadig a ZIP file
2. Modify the *hello-world* example.
3. Start an HTTP server to open the *index.html* of the example (i.e. the live server of VS Code)

You should open multiple instances of the client in differnt windows of you browser by copying the URL from the first to several othe windows. Move the resize the windows in a way that you can see all of (for example 3 or 4) at the same time Open the console of the developer tools of each browser watch teh printouts while you click inside the browser window.

The *hello-world* example consists of the followig files:
- **`index.html`** | the HTML file of the client
- **`player.js`** | the JavaScript of the client
- **`style.css`** | the CSS style sheet of the client

## 3 Web Room Request

### 3.1 Websocket Requests
The *Web Rooms* sever provides a set of requests to enter rooms, query information about a room (e.g. the number of clients currently connected to the room) and send messages to other clients.

All requests are led and terminated by '*' as for example `'*enter-room*'` or `'*broadcast-message*'`.

#### 3.1.1 Entering and Exiting Rooms
A client sends the following request to enter a room. A room is created when the first client requests to enter. When the last client of a particular room has been disconnected, the room is deleted.

##### `'*enter-room*' <name>`
- adds the client to a room given by name and assigns it an ID within the room
- &#8594; sends `'*client-id*' <client id>`

##### `'*exit-room*'`
- removes the client from its current room

#### 3.1.2 Clients of a Room
A client that has entered a room can send the following requests to get informed about the (other) connected clients in the same room.

##### `'*get-client-ids*'` 
- returns all other clients that entered the room (ids)  
- &#8594; sends `'*client-ids*' [<client id> ...]` with an array of the IDs of all connected clients including the requesting client

##### `'*subscribe-client-enter-exit*'`
- subscribe to notifications sent when other clients enter or exit the room
- &#8594; sends `'*client-enter*' <client id>` for each client already connected and each time a new client enters the room
- &#8594; sends `'*client-exit*' <client id>` each time a new client exits from the room

##### `'*unsubscribe-client-enter-exit*'`
- unsubscribe from clients enter/exit notifications

##### `'*get-client-count*'` 
- get the total number of clients connected the room
- &#8594; sends `'*client-count*' <client count>`

##### `'*subscribe-client-count*'` 
- subscribe to notifications sent when the number of connected clients changes
- &#8594; sends `'*client-count*' <client count>` for current client count and each time a new client enters ot exits the room

##### `'*unsubscribe-client-count*'`
- unsubscribe from the client count notifications

#### 3.1.3 Messages to other Clients
A client that has entered a room can send the following requests to send messages to the other clients in the same room.

##### `'*send-message*' <receiver client id> <message>`
- send a message to a another client within the room given by its id

##### `'*broadcast-message*' <message>`
- send a message to all other clients in the room

#### 3.1.4 Data of a Room (untested!)
A client that has entered a room can send the following requests to set and get data items stored within the room.

##### `'*set-data*' <key> <value>`
- set the value of a data item

##### `'*get-data*' <key>`
- get the value of a data item
- &#8594; sends `<key> <value>` of the requested data item

##### `'*subscribe-data*' <key>`
- subscribe to notifications sent when the value of the given data item changes
- &#8594; sends `<key> <value>` for the current value and each time the value of the given data item changes

##### `'*unsubscribe-data*' <key>`
- unsubscribe from data notifications

#### 3.1.5 Errors
All of the requests and messages described above return `'*error*' ['no-room']` when they are called before the requesting client has entered a room by requesting `'*enter-room*'`. Exceptions are the `'*enter-room*'` request itself as well as `'*reset-all*'`.

### 3.2 HTTP Requests (not yet implemented)

##### `get-client-ids <room name>`

##### `get-client-ids <room name>`

##### `get-data <room name>`

##### `reset-room <room name>`

##### `reset-all`
