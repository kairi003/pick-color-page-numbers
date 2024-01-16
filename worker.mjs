// await import('/pdfjs-dist/build/pdf.min.mjs');
import * as pdfjsLib from './pdfjs-dist/build/pdf.min.mjs';

const MESSAGE_TYPE = {
  READY: 'ready',
  LOAD: 'load',
  PROGRESS: 'progress',
  DONE: 'done',
  ERROR: 'error'
};

// Init worker
self.window = self;
self.document = {
  fonts: self.fonts,
  createElement: name => {
    if (name === 'canvas') {
      return new OffscreenCanvas(0, 0);
    }
  }
};
const worker = new Worker('./pdfjs-dist/build/pdf.worker.min.mjs', {type: 'module'});
pdfjsLib.GlobalWorkerOptions.workerPort = worker;

const isMonochrome = async (page) => {
  console.log('Loaded Page:', page.pageNumber)
  const viewport = page.getViewport({scale: 2});
  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  const renderTask = page.render({
    canvasContext: ctx,
    viewport
  });
  await renderTask.promise;
  console.log('Rendered Page:', page.pageNumber)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const {data} = imageData;
  return [...Array(data.length / 4).keys()]
    .every(i => data[4 * i] === data[4 * i + 1] && data[4 * i] === data[4 * i + 2]);
}

self.onmessage = async (event) => {
  try {
    console.log('worker received message', event);
    const {id, data} = event.data;
    const pdf = await pdfjsLib.getDocument({
      data,
      cMapUrl: "./pdfjs-dist/cmaps/",
      cMapPacked: true,
      ownerDocument: document
    }).promise;
    console.log('Loaded PDF')
    self.postMessage({id, type: MESSAGE_TYPE.LOAD, data: pdf.numPages});
    const pageNumbers = [...Array(pdf.numPages).keys()].map(i => i + 1);
    const postProgress = s => (self.postMessage({id, type: MESSAGE_TYPE.PROGRESS}), s);
    const isMonochromeArray = await Promise.all(
      pageNumbers.map(p=>pdf.getPage(p).then(isMonochrome).then(postProgress)));
    self.postMessage({id, type: MESSAGE_TYPE.DONE, data: isMonochromeArray});
  } catch (e) {
    console.error(e);
    self.postMessage({id, type: MESSAGE_TYPE.ERROR, data: e});
  }
};

self.postMessage({type: MESSAGE_TYPE.READY});
