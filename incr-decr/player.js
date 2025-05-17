const incrDisplay = document.getElementById('incr-display');
const decrDisplay = document.getElementById('decr-display');
const scoreDisplay = document.getElementById('score-display');
const clientDisplay = document.getElementById('client-display');

// address of the WebSocket server
// const webRoomsWebSocketServerAddr = 'https://nosch.uber.space/web-rooms/';
const webRoomsWebSocketServerAddr = 'http://localhost:8080';

let clientId = null; // client ID sent by web-rooms server when calling 'enter-room'
let clientCount = 0; // number of clients connected to the same room
let clientIds = new Set();
let score = null;

incrDisplay.addEventListener('pointerdown', onIncrDown);
incrDisplay.addEventListener('pointerup', onIncrUp);
decrDisplay.addEventListener('pointerdown', onDecrDown);
decrDisplay.addEventListener('pointerup', onDecrUp);

function onIncrDown() {
  sendRequest('*set-data*', 'score', score + 1);
  incrDisplay.classList.add('highlight');
}

function onIncrUp() {
  incrDisplay.classList.remove('highlight');
}

function onDecrDown() {
  sendRequest('*set-data*', 'score', score - 1);
  decrDisplay.classList.add('highlight');
}

function onDecrUp() {
  decrDisplay.classList.remove('highlight');
}

/****************************************************************
 * websocket communication
 */
const socket = new WebSocket(webRoomsWebSocketServerAddr);

// listen to opening websocket connections
socket.addEventListener('open', (event) => {
  sendRequest('*enter-room*', 'incr-decr');
  sendRequest('*subscribe-client-count*');
  sendRequest('*init-data*', 'score', 0);
  sendRequest('*subscribe-data*', 'score');

  // ping the server regularly with an empty message to prevent the socket from closing
  setInterval(() => socket.send(''), 30000);
});

socket.addEventListener("close", (event) => {
  clientId = null;
  document.body.classList.add('disconnected');
});

// listen to messages from server
socket.addEventListener('message', (event) => {
  const data = event.data;

  if (data.length > 0) {
    const incoming = JSON.parse(data);
    const selector = incoming[0];

    // dispatch incomming messages
    switch (selector) {
      // responds to '*enter-room*'
      case '*client-id*':
        clientId = incoming[1];
        clientDisplay.innerHTML = `#${clientId}/${clientCount}`;
        break;

      // responds to '*subscribe-client-count*'
      case '*client-count*':
        clientCount = incoming[1];
        clientDisplay.innerHTML = `#${clientId}/${clientCount}`;
        break;

      case '*client-enter*':
        const enterId = incoming[1];
        clientIds.add(enterId);
        break;

      case '*client-exit*':
        const exitId = incoming[1];
        clientIds.delete(exitId);
        break;

      case '*error*': {
        const message = incoming[1];
        console.warn('server error:', ...message);
        break;
      }

      case 'score':
        score = incoming[1];
        scoreDisplay.innerText = score;
        break;

      default:
        console.log(`unknown incoming messsage: [${incoming}]`);
        break;
    }
  }
});

// helper function to send requests over websocket to web-room server
function sendRequest(...message) {
  const str = JSON.stringify(message);
  socket.send(str);
}
