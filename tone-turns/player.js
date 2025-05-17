const infoDisplay = document.getElementById('info-display');
const clientDisplay = document.getElementById('client-display');

// address of the WebSocket server
const webRoomsWebSocketServerAddr = 'https://nosch.uber.space/web-rooms/';

const pitches = [
  60, 67, 62, 69, 64, 71, 72, 79, 74, 81, 76, 83, 48, 55, 50, 57, 52, 59,
  84, 77, 82, 75, 80, 73, 72, 65, 70, 63, 68, 61, 60, 53, 58, 51, 56, 49,
];

let audioContext = null;
let clientId = null; // client ID sent by web-rooms server when calling 'enter-room'
let clientCount = 0; // number of clients connected to the same room
let clientIds = new Set();
let yourAreFirst = false;
let isYourTurn = false;

displayText('Click or touch screen to start...');
window.addEventListener('pointerdown', onPointer);

function onPointer() {
  if (audioContext === null) {
    // start web audio
    audioContext = new AudioContext();

    // start
    enterRoom();
  } else if (clientId !== null && isYourTurn) {
    // pass on to random client
    passOn();
  }
}

function enterRoom() {
  sendRequest('*enter-room*', 'tone-turns');
  sendRequest('*subscribe-client-count*');
  sendRequest('*subscribe-client-enter-exit*');

  displayText('Wait for your turn...');
}

function takeYourTurn() {
  isYourTurn = true;

  displayText('Now', true);
}

function passOn() {
  isYourTurn = false;

  const array = Array.from(clientIds);
  const randomIndex = Math.floor(array.length * Math.random());
  const nextId = array[randomIndex];
  sendRequest('*send-message*', nextId, 'your-turn');

  displayText('Wait for your turn...');
}

function displayText(text = '', highlight = false) {
  if (highlight) {
    document.body.classList.add('highlight');
    infoDisplay.classList.add('highlight');
  } else {
    document.body.classList.remove('highlight');
    infoDisplay.classList.remove('highlight');
  }

  infoDisplay.innerText = text;
}

window.addEventListener('beforeunload', (event) => {
  if (isYourTurn) {
    passOn();
  }
});

/****************************************************************
 * websocket communication
 */
const socket = new WebSocket(webRoomsWebSocketServerAddr);

// listen to opening websocket connections
socket.addEventListener('open', (event) => {
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

        if (clientCount === 1) {
          displayText('Waiting for other players to connect...');
          yourAreFirst = true;
        } else if (yourAreFirst) {
          yourAreFirst = false;
          takeYourTurn();
        }

        break;

      case '*client-enter*':
        const enterId = incoming[1];
        clientIds.add(enterId);
        break;

      case '*client-exit*':
        const exitId = incoming[1];
        clientIds.delete(exitId);
        break;

      case 'your-turn':
        const pitch = pitches[clientId % pitches.length];
        playNote(pitch);
        takeYourTurn();
        break;

      case '*error*': {
        const message = incoming[1];
        console.warn('server error:', ...message);
        break;
      }

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

/****************************************************************
 * audio synthesis
 */
function playNote(pitch = 69, gain = 1, modIndex = 1, attack = 0.001, duration = 1, freqRatio = 1.001, attackRatio = 1, durationRatio = 0.333) {
  const time = audioContext.currentTime;
  const carFreq = pitchToFreq(pitch);

  const carEnv = audioContext.createGain();
  carEnv.connect(audioContext.destination);
  carEnv.gain.value = 0;
  carEnv.gain.setValueAtTime(0, time);
  carEnv.gain.linearRampToValueAtTime(gain, time + attack);
  carEnv.gain.exponentialRampToValueAtTime(0.001, time + duration - 0.01);
  carEnv.gain.linearRampToValueAtTime(0, time + duration);

  const carOsc = audioContext.createOscillator();
  carOsc.connect(carEnv);
  carOsc.type = 'sine';
  carOsc.frequency.value = carFreq;
  carOsc.start(time);
  carOsc.stop(time + duration);

  if (modIndex !== 0) {
    const modFreq = carFreq * freqRatio;
    const modDuration = duration * durationRatio;
    const modAttack = Math.min(attack * attackRatio, modDuration);

    const modEnv = audioContext.createGain();
    modEnv.connect(carOsc.frequency);
    modEnv.gain.value = 0;
    modEnv.gain.setValueAtTime(0, time);
    modEnv.gain.linearRampToValueAtTime(carFreq * modIndex, time + modAttack);
    modEnv.gain.exponentialRampToValueAtTime(0.001, time + modDuration - 0.01);
    modEnv.gain.linearRampToValueAtTime(0, time + modDuration);

    const modOsc = audioContext.createOscillator();
    modOsc.connect(modEnv);
    modOsc.type = 'sine';
    modOsc.frequency.value = modFreq;
    modOsc.start(time);
    modOsc.stop(time + modDuration);
  }
}

const refPitch = 69;
const refFreq = 440;
function pitchToFreq(pitch) {
  return refFreq * Math.exp(0.05776226504666211 * (pitch - refPitch)); // pow(2, val / 1200)
}
