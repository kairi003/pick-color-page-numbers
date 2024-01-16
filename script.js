
const MESSAGE_TYPE = {
  READY: 'ready',
  LOAD: 'load',
  PROGRESS: 'progress',
  DONE: 'done',
  ERROR: 'error'
};

const fileInput = document.getElementById('fileInput');
const requireHyphenate = document.getElementById('requireHyphenate');
const progress = document.getElementById('progress');
const progressText = document.getElementById('progressText');
const colorOutput = document.getElementById('colorOutput');
const monoOutput = document.getElementById('monoOutput');
const errorOutput = document.getElementById('errorOutput');

const hyphenateRange = (arrSrc) => {
  const arr = arrSrc.map(x => parseInt(x)).filter(x => !isNaN(x)).sort((a, b) => a - b);
  const ranges = [];
  let start = arr[0];
  let end = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === end + 1) {
      end = arr[i];
    } else {
      ranges.push(start === end ? start : `${start}-${end}`);
      start = end = arr[i];
    }
  }
  ranges.push(start === end ? start : `${start}-${end}`);
  return ranges.join(',');
};
const updateOutputShow = () => {
  const format = requireHyphenate.checked ? hyphenateRange : arr => arr.join(',');
  colorOutput.textContent = format(colorOutput.dataset.pages.split(','));
  monoOutput.textContent = format(monoOutput.dataset.pages.split(','));
}
requireHyphenate.addEventListener('change', updateOutputShow);


let worker = null;
let taskId = 0;

const messageHandle = (event) => {
  const { id, type, data } = event.data;
  console.log('Receive:', {id, type, data});
  if (id !== taskId) return;
  switch (type) {
    case MESSAGE_TYPE.LOAD:
      progress.max = +data;
      progress.value = 0;
      progressText.textContent = `${progress.value} / ${progress.max}`;
      break;
    case MESSAGE_TYPE.PROGRESS:
      progress.value++;
      progressText.textContent = `${progress.value} / ${progress.max}`;
      break;
    case MESSAGE_TYPE.DONE:
      const isMonoArray = data;
      colorOutput.dataset.pages = isMonoArray
        .map((isMono, index) => isMono ? '' : index + 1)
        .filter(Boolean).join(',');
      monoOutput.dataset.pages = isMonoArray
        .map((isMono, index) => isMono ? index + 1 : '')
        .filter(Boolean).join(',');
      updateOutputShow();
      break;
    case MESSAGE_TYPE.ERROR:
      errorOutput.textContent = data;
      break;
  }
};

fileInput.addEventListener('change', async event => {
  console.log(event);
  const file = fileInput.files[0];
  if (!file) return;
  const arrayBuffer = await file.arrayBuffer();
  worker?.terminate();
  worker = new Worker('./worker.mjs', { type: 'module' });
  worker.addEventListener('message', (event) => {
    console.log('worker ready');
    worker.addEventListener('message', messageHandle);
    worker.postMessage({
      id: ++taskId,
      data: arrayBuffer
    });
  }, { once: true });
});
