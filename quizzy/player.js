const questionElem = document.getElementById('question-container');
const infoElem = document.getElementById('info-container');

// const webSocketAddr = 'http://localhost:3000';
// const webSocketAddr = 'http://192.168.0.1:3000';
const webSocketAddr = 'http://nosch.uber.space/web-rooms/';

const optionIds = ['a', 'b', 'c', 'd'];
let clientId = null;
let responseId = null;
let selectedOptionId = null;

const welcomeText = {
  text: `Welcome to Quizzy! <br/>
    <span class="light small">For each question you have 4 answer options to chose from.
    To chose your answer, click or touch one of the options <em>A</em>, <em>B</em>, <em>C</em>, or <em>D</em>.</span>`,
  options: {
    a: `Answer A.`,
    b: `Answer B.`,
    c: `Answer C.`,
    d: `Answer D.`,
  }
}

/*************************************************************
 * start
 */
function startPlaying() {
  registerOptionClicks();
  setQuestion(welcomeText);
};

function setQuestion(question) {
  resetAnswer();

  questionElem.innerHTML = question.text;

  for (let optionId of optionIds) {
    const textElem = document.querySelector(`div.answer[data-option=${optionId}] div.text`);
    textElem.innerHTML = question.options[optionId];
  }
}

function setAnswer(optionId) {
  if (optionId !== selectedOptionId) {
    if (optionId !== null) {
      const textElem = document.querySelector(`div.answer[data-option=${optionId}]`);
      textElem.classList.add('selected');
    }

    if (selectedOptionId !== null) {
      const textElem = document.querySelector(`div.answer[data-option=${selectedOptionId}]`);
      textElem.classList.remove('selected');
    }

    selectedOptionId = optionId;

    if (clientId !== null && responseId !== null) {
      sendRequest('send-message', responseId, ['answer', optionId, clientId]);
    }
  }
}

function resetAnswer() {
  responseId = null;
  setAnswer(null);
}

/*************************************************************
 * click events
 */
function registerOptionClicks() {
  for (let optionId of optionIds) {
    const textElem = document.querySelector(`div.answer[data-option=${optionId}]`);
    textElem.addEventListener('click', onClick);
  }
}

function onClick(e) {
  let target = e.target;
  let option = target.dataset.option;

  if (!option) {
    option = target.parentElement.dataset.option;
  }

  setAnswer(option);
}

/****************************************************************
 * websocket communication
 */
const socket = new WebSocket(webSocketAddr);

// listen to opening websocket connections
socket.addEventListener('open', (event) => {
  sendRequest('enter-room', 'quizzy');
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
      case 'client-id':
        clientId = incoming[1];
        startPlaying();
        break;

      case 'question': {
        const question = incoming[1];
        setQuestion(question);
        responseId = question.responseId;
        break;
      }

      case 'reset': {
        setQuestion(welcomeText);
        responseId = null;
        break;
      }

      case 'error': {
        const message = incoming[1];
        console.warn('server error:', ...message);
        break;
      }

      default:
        break;
    }
  }
});

window.addEventListener("close", () => {
})

function sendRequest(...message) {
  const str = JSON.stringify(message);
  socket.send(str);
}
