// import obj from './pdfjs-dist/build/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs-dist/build/pdf.worker.min.mjs';

const colorOutput = document.getElementById('colorOutput');
const monoOutput = document.getElementById('monoOutput');
const errorOutput = document.getElementById('errorOutput');
const printError = err => {
  console.error(err);
  errorOutput.textContent = err;
}

const hyphenateRange = (arr) => {
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
}
const requireHyphenate = document.getElementById('requireHyphenate');
const updateOutputShow = () => {
  const format = requireHyphenate.checked ? hyphenateRange : arr => arr.join(',');
  colorOutput.textContent =
    format(colorOutput.dataset.pages.split(',').map(x=>parseInt(x)));
  monoOutput.textContent =
    format(monoOutput.dataset.pages.split(',').map(x=>parseInt(x)));
}
requireHyphenate.addEventListener('change', updateOutputShow);

const progress = document.getElementById('progress');
const progressText = document.getElementById('progressText');
const updateProgress = stat => {
  progress.value += 1;
  progressText.textContent = `${progress.value}/${progress.max}`;
  return stat
};

document.getElementById('fileInput').addEventListener('change', async e => {
  if (!e.target.files.length) return;
  const file = e.target.files[0];
  const data = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data,
    cMapUrl: "./pdfjs-dist/cmaps/",
    cMapPacked: true
  });
  const pdf = await loadingTask.promise.catch(printError);
  progress.max = pdf.numPages;
  progress.value = 0;
  progressText.textContent = `${progress.value}/${progress.max}`;

  const getImageData = async (pageNum) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const renderContext = {
      canvasContext: ctx,
      viewport
    };
    await page.render(renderContext).promise;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageData;
  }
  const isMonochrome = (imageData) => {
    const { data } = imageData;
    return [...Array(data.length / 4).keys()]
      .every(i => data[4 * i] === data[4 * i + 1] && data[4 * i] === data[4 * i + 2]);
  }
  const pageNums = [...Array(pdf.numPages).keys()].map(i => i + 1);
  Promise.all(pageNums.map(p =>
    getImageData(p).then(isMonochrome).then(updateProgress)))
    .then(isMonochromeArray => {
      colorOutput.dataset.pages =
        pageNums.filter((_, i) => !isMonochromeArray[i]).join(',');
      monoOutput.dataset.pages =
        pageNums.filter((_, i) => isMonochromeArray[i]).join(',');
      updateOutputShow();
    }).catch(printError);
});