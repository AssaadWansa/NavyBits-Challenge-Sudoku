import Tesseract from "tesseract.js";
import {Board} from "../Components/Sudoku"; 


//Handling file (image) upload and allowing future processing
export const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>,setUploadedImage: (img: string) => void,processImage: (imgData: string) => void) => {
  const file = e.target.files ? e.target.files[0] : null;
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setUploadedImage(reader.result as string);
        processImage(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
};

//process uploaded image to detct a sudoku inside
export const processImage = async (
  imageData: string,
  setBoard: (board: Board) => void,
  setOcrInProgress: (progress: boolean) => void,
  checkConflicts: (board: Board) => void,
  setGeneratedCells: (cells: Set<string>) => void,
  setConflictCells: (cells: Set<string>) => void,
  setLockedCells: (cells: Set<string>) => void,
  setHintLimit: (limit: number) => void
) => {
    if (!imageData) return;
  
    setOcrInProgress(true);
    const image = new Image();
    image.src = imageData;
  
    image.onload = async () => {
      try {
        const MAX_WIDTH = 500; // Maximum width for resizing
        const MAX_HEIGHT = 500;
        let { width, height } = image;
  
        //Resize large images
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
  
        //Create canvas for processing
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Failed to get 2d context for canvas.");
        }
  
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);
  
        //Converting to grayscale (preprocessing phase)
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (!imageData) {
          throw new Error("Failed to get image data.");
        }
  
        let data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = data[i + 1] = data[i + 2] = avg; // Grayscale
        }
        ctx.putImageData(imageData, 0, 0);
  
        //Applying otsu thresholding (for picture segmentation) 
        const otsuThreshold = calculateOtsuThreshold(imageData);
        for (let i = 0; i < data.length; i += 4) {
          const brightness = data[i];
          const value = brightness > otsuThreshold ? 255 : 0; // Binarize the image
          data[i] = data[i + 1] = data[i + 2] = value;
        }
        ctx.putImageData(imageData, 0, 0);
  
        //Apply crop based on bouding box (external sudoku border)
        const croppedCanvas = cropImage(canvas);
  
         //Apply sudoku grid segmentation into cells
        const cells = segmentSudokuGrid(croppedCanvas);
  
        //recognize digits in cells using OCR
        const results = await Promise.all(
          cells.map(async (cellCanvas) => {
            const downscaledCanvas = document.createElement("canvas");
            const downscaledCtx = downscaledCanvas.getContext("2d");
            if (!downscaledCtx) {
              throw new Error("Failed to get 2d context for downscaled canvas.");
            }
            
            downscaledCanvas.width = cellCanvas.width / 2; // Downscale for faster OCR
            downscaledCanvas.height = cellCanvas.height / 2;
            downscaledCtx.drawImage(cellCanvas, 0, 0, downscaledCanvas.width, downscaledCanvas.height);
  
            const { data: { text, confidence } } = await Tesseract.recognize(downscaledCanvas, "eng", { logger: m => console.log(m) });
            const digit = text.trim();
            const number = parseInt(digit, 10);
            return !isNaN(number) && number >= 1 && number <= 9 && confidence > 20 ? number : null;
          })
        );
  
        //Construct a sudoku board from OCR results
        const ocrBoard: Board = [];
        for (let row = 0; row < 9; row++) {
          ocrBoard.push(results.slice(row * 9, (row + 1) * 9));
        }
  
        //Validating constructed board
        if (isValidSudokuBoard(ocrBoard)) {
          setBoard(ocrBoard);
          checkConflicts(ocrBoard);
        } 
        else {
          alert("The uploaded image does not contain a recognizable Sudoku grid.");}
      } 
      catch (err) {
        console.error("OCR Error:", err);
        alert("An error occurred during image processing. Please try again.");
      } 
      finally {
        setOcrInProgress(false);
      }
    };
    setGeneratedCells(new Set());
    setConflictCells(new Set());
    setLockedCells(new Set());
    setHintLimit(3);
};

//Detecting the outer border of sudoku and crop on it
export const cropImage = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    //Get image data from canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    //Checking pixels to find the bounding box
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4;
        const brightness = data[index]; 
        if (brightness < 128) { //consider dark pixels as part of the grid
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    const boundingBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
    //Create a new canvas to hold the cropped image
    const croppedCanvas= document.createElement("canvas");
    const croppedCtx = croppedCanvas.getContext("2d");
    if (!croppedCtx) throw new Error("Failed to get cropped canvas context");
    croppedCanvas.width = boundingBox.width;
    croppedCanvas.height = boundingBox.height;

    croppedCtx.drawImage(
      canvas,
      boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height,
      0, 0, boundingBox.width, boundingBox.height
    );

    return croppedCanvas;
};

//Calculate threshold (method: Otsu)
export const calculateOtsuThreshold = (imageData: ImageData): number => {
    const histogram = new Array(256).fill(0);  //Array of 256 bins holding frequency of pixel intensities (Grayscale images constidued of black gray and white, lightest is white with intensity of 255)
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      histogram[data[i]]++;
    }

    let total = data.length / 4; //calculate total number of pixels (4=rgba)
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * histogram[t]; //calculate weighted sum of intensities (how many time the intensity is appearing)

    let sumB = 0;  //sum of pixel intensities for the background class
    let wB = 0; // number of pixels in the background class
    let wF = 0; //number of pixels in the foreground class
    let varMax = 0; //maximum between-class variance(to find the optimal threshold)
    let threshold = 0; //threshold intensity will maximizes the between-class variance
    for (let t = 0; t < 256; t++) {  //iterating through all possible thresholds (0 to 255)
      wB += histogram[t];
      if (wB === 0) continue;
      wF = total - wB;
      if (wF === 0) break;
      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const varBetween = wB * wF * (mB - mF) ** 2;
      if (varBetween > varMax) {
        varMax = varBetween;
        threshold = t;
      }
    }
    return threshold;
};

//Divide image sudoku board into 9x9 grid
export const segmentSudokuGrid = (canvas: HTMLCanvasElement): HTMLCanvasElement[] => {
    const cellWidth = canvas.width / 9;
    const cellHeight = canvas.height / 9;
  
    const cells: HTMLCanvasElement[] = [];
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const cellCanvas = document.createElement("canvas");
        cellCanvas.width = cellWidth;
        cellCanvas.height = cellHeight;
        const cellCtx = cellCanvas.getContext("2d");
  
        if (cellCtx) {
          cellCtx.drawImage(
            canvas,
            col * cellWidth,
            row * cellHeight,
            cellWidth,
            cellHeight,
            0,
            0,
            cellWidth,
            cellHeight
          );
          cells.push(cellCanvas);
        }
      }
    }
  
    return cells;

};

//validate board detected by ocr
export const isValidSudokuBoard = (board: Board): boolean => {
    return (
        board.length === 9 && board.every((row) => row.length === 9) &&
        board.flat().every((cell) => cell === null || (cell >= 1 && cell <= 9))
      );
};
