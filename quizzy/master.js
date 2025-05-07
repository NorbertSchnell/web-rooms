const questionElem = document.getElementById('question-container');
const nextQuestionButton = document.getElementById('next-question');
const correctAnswerButton = document.getElementById('correct-answer');
const infoElem = document.getElementById('info-container');
const webSocketPort = 3000;
const webSocketAddr = '192.168.178.94';

const optionIds = ['a', 'b', 'c', 'd'];
const answers = {};

for (let optionId of optionIds) {
  const answer = answers[optionId] = {};
  answer.clients = new Set();
  answer.elem = document.querySelector(`div.answer[data-option=${optionId}]`);
  answer.textElem = document.querySelector(`div.answer[data-option=${optionId}] div.text`);
  answer.sliderElem = document.querySelector(`div.answer[data-option=${optionId}] div.slider`);
}

let clientId = null;
let clientCount = 0;
let maxClientCount = 10;
let currentQuestionIndex = -1;
let currentQuestion = null;

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

const questions = [{
  text: `What did you have for breakfast?`,
  options: {
    a: `Nothing.`,
    b: `Müsli.`,
    c: `Bread with something sweet.`,
    d: `Bread with something salty.`,
  }
}, {
  text: `What is the height of Mount Everest?`,
  options: {
    a: `8 196 m`,
    b: `8 677 m`,
    c: `8 849 m`,
    d: `8 912 m`,
  },
  correct: 'c',
}, {
  text: `Which is the longest river on Earth?`,
  options: {
    a: `Danube`,
    b: `Nile`,
    c: `Amazon`,
    d: `Yangtze`,
  },
  correct: 'b',
}, {
  text: `Do you like coding?`,
  options: {
    a: `Yes, very much.`,
    b: `Well, it's ok.`,
    c: `No, not really.`,
    d: `Ugh, not at all.`,
  },
}, {
  text: `That's all! Did you like this experience?`,
  options: {
    a: `That was great!`,
    b: `It was ok.`,
    c: `Not so much.`,
    d: `Not at all!`,
  }
}];

/*************************************************************
 * start
 */
function startMaster() {
  setQuestion(welcomeText);
  nextQuestionButton.addEventListener('click', gotoNextQuestion);
  correctAnswerButton.addEventListener('click', displayCorrectAnswer);
};

function setQuestion(question) {
  resetQuestion();

  questionElem.innerHTML = question.text;

  for (let optionId of optionIds) {
    const textElem = answers[optionId].textElem;
    textElem.innerHTML = question.options[optionId];
  }
}

function resetQuestion() {
  for (let optionId of optionIds) {
    const answer = answers[optionId]
    answer.clients.clear();
    answer.elem.classList.remove('correct');
    answer.elem.classList.remove('wrong');
    answer.sliderElem.style.width = 0;
  }

  correctAnswerButton.classList.remove('show');
}

function setAnswer(optionId, clientId) {
  if (currentQuestionIndex >= 0 && clientCount > 1) {
    for (let id of optionIds) {
      const answer = answers[id];

      if (id === optionId) {
        answer.clients.add(clientId);
      } else {
        answer.clients.delete(clientId);
      }

      const percentage = 100 * Math.min(1, answer.clients.size / (maxClientCount - 1));
      answer.sliderElem.style.width = `${percentage}%`;
    }
  }
}

function updateInfo() {
  infoElem.innerText = `question: ${currentQuestionIndex + 1}/${questions.length} | players connected: ${clientCount - 1}`;
}

function gotoNextQuestion() {
  currentQuestionIndex = (currentQuestionIndex + 1) % questions.length;
  currentQuestion = questions[currentQuestionIndex];

  setQuestion(currentQuestion);

  if (currentQuestion.correct) {
    correctAnswerButton.classList.add('show');
  }

  currentQuestion.responseId = clientId;
  sendRequest('broadcast-message', ['question', currentQuestion]);
  updateInfo();
}

function displayCorrectAnswer() {
  if (currentQuestion.correct) {
    const correctOptionId = currentQuestion.correct;

    for (let id of optionIds) {
      const answer = answers[id];
      
      if (id === correctOptionId) {
        answer.elem.classList.add('correct');
      } else {
        answer.elem.classList.add('wrong');
      }
    } 

    correctAnswerButton.classList.remove('show');
  }
}

/****************************************************************
 * websocket communication
 */
const socket = new WebSocket(`https://${webSocketAddr}:${webSocketPort}`);

// listen to opening websocket connections
socket.addEventListener('open', (event) => {
  sendRequest('enter-room', 'quizzy');
  sendRequest('subscribe-client-count');
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
        startMaster();
        break;

      case 'client-count':
        clientCount = incoming[1];
        maxClientCount = Math.max(maxClientCount, clientCount);
        updateInfo();
        break;

      case 'answer': {
        const answerOptionId = incoming[1];
        const answerClientId = incoming[2];
        setAnswer(answerOptionId, answerClientId);
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
