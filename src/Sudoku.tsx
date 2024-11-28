import React, { useState, useEffect } from 'react';
import Tesseract from 'tesseract.js'; 
import './Sudoku.css';

//Creating an empty 9x9 board (Array of 9 spaces, each space is filled with an array of 9 nulls)
type Board = (number | null)[][];  //Defining Board by a 2D array that accepts number or null values
const generateEmptyBoard= (): Board => Array(9).fill(null).map(() => Array(9).fill(null));

//Validating the Sudoku algorithm: No identicals in same Row, Column, or 3x3 Box
const isValid = (board: Board, row: number, col: number, num: number): boolean => {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num || board[i][col] === num) return false;
  }
  const startRow= 3*Math.floor(row / 3); //First Row
  const startCol= 3*Math.floor(col / 3); //Frst Column
  for (let r = startRow; r < startRow + 3; r++) {
  for (let c = startCol; c < startCol + 3; c++) {
    if (board[r][c] === num) return false;
    }
  }
  return true;
};

//Randomizing order in array will be used later in filling Sudoku board
const shuffle = (arr: number[]): number[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

//Filling board with numbers (using backtraking) to generate sudoku later
const fillBoard = (board: Board): boolean => {
  for (let row = 0; row < 9;row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === null) {
        const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of numbers) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (fillBoard(board)) return true;
            board[row][col] = null;
          }
        }
        return false;
      }
    }
  }
  return true;
};


// Randomly removing a bunch of numbers (count based on difficulty) from cells for generated sudoku
const removeNumbers = (board: Board, count: number, generatedCells: Set<string>) => {
  let removed = 0;
  while (removed < count) {
    const row = Math.floor(Math.random() * 9);
    const col = Math.floor(Math.random() * 9);
    if (board[row][col] !== null) {
      board[row][col] = null;
      generatedCells.delete(`${row}-${col}`);
      removed++;
    }
  }
};

//Generating Sudoku based on difficulty (Number of hidden cells grows with difficulty)
const generatePuzzle = (difficulty: 'easy' | 'medium' | 'hard'): { board: Board; generatedCells: Set<string> } => {
  const board = generateEmptyBoard();
  const generatedCells = new Set<string>();
  fillBoard(board);  //filled board
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      generatedCells.add(`${row}-${col}`);
    }
  }
  const cellsToRemove = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 40 : 50;
  removeNumbers(board, cellsToRemove, generatedCells); //Emptying cells based on difficulty
  return { board, generatedCells };
};

//Introducing sudoku functional components
const Sudoku: React.FC = () => {
  const [board, setBoard] = useState<Board>(generateEmptyBoard());  //Stores current state of sudoku board (empty)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy'); //Stores Difficulty level for puzzle generation
  const [generatedCells, setGeneratedCells] = useState<Set<string>>(new Set());  //tracks cells that was generated
  const [conflictCells, setConflictCells] = useState<Set<string>>(new Set()); //Highlighting cells that violates sudoku rules (identicals in same row/col/3x3 grids)
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null); //Identifies currently selected cell by user
  const [lockedCells, setLockedCells] = useState<Set<string>>(new Set()); //Identifies cells locked by user 
  const [hintLimit, setHintLimit] = useState(3); //sets limit for hints 
  const [uploadedImage, setUploadedImage] = useState<string | null>(null); //tracks uploaded image
  const [previewModalOpen, setPreviewModalOpen] = useState(false); //Modal on screen to open and view the uploaded image
  const [ocrInProgress, setOcrInProgress] = useState(false);  //checks that ocr is running on uploaded image
  const [storedSolution, setStoredSolution] = useState<Board | null>(null); //stores solution for current entered (locked) sudoku

  //Allowing user navigating between cells using keyboard arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedCell) {
        let { row, col } = selectedCell;
        if (e.key === 'ArrowUp' && row > 0) row -= 1;
        if (e.key === 'ArrowDown' && row < 8) row += 1;
        if (e.key === 'ArrowLeft' && col > 0) col -= 1;
        if (e.key === 'ArrowRight' && col < 8) col += 1;
        setSelectedCell({ row, col });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCell]);

  //highlighting selected cell  
  useEffect(() => {
    if (selectedCell) {
      const cellId = `${selectedCell.row}-${selectedCell.col}`;
      const inputElement = document.getElementById(cellId) as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
      }
    }
  }, [selectedCell]);

  //generating new sudoku based on chosen difficulty (used for generate button)
  const generateNewPuzzle = () => {
    const { board, generatedCells } = generatePuzzle(difficulty);
    const solvedBoard = board.map(r => r.slice());
    if (!fillBoard(solvedBoard)) {
      alert("Failed to generate a solvable puzzle. Please try again.");
      return;}  
    setBoard(board); //chaging board state to fill it with numbers
    setStoredSolution(solvedBoard); //storing solution for generated sudoku
    setGeneratedCells(generatedCells);  //setting which cells to hide and which to remain
    setConflictCells(new Set());  //remove highlights from cells that was with conflicts
    setLockedCells(new Set()); //lock generated cells
    setHintLimit(3);  //reset hint count to 3
  };

  //Reset funtion to be used for reset button
  const handleReset= () => {
    setBoard(generateEmptyBoard()); //setting board state to empty
    setGeneratedCells(new Set());  //generated cells set to empty
    setConflictCells(new Set()); //remove highlights from cells that was with conflicts
    setLockedCells(new Set()); //locked cells unlocked
    setHintLimit(3);  //reset hint count to 3

  };

  //checking entered numbers and updating the board 
  const handleInputChange = (value: string, row: number, col: number) => {
    const num = parseInt(value, 10);
    const newBoard = board.map(r => r.slice());
    if (generatedCells.has(`${row}-${col}`)) return;
    newBoard[row][col] = !isNaN(num) && num >= 1 && num <= 9 ? num : null;
    setBoard(newBoard);
    checkConflicts(newBoard);
  };
  
  //checking if there are any identical numbers in same row, column or 3x3grid 
  const checkConflicts = (board: Board) => {
    const newConflictCells = new Set<string>();
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const num = board[row][col];
        if (num !== null) {
          if (board[row].indexOf(num) !== col) newConflictCells.add(`${row}-${col}`);
          for (let r = 0; r < 9; r++) {
            if (r !== row && board[r][col] === num) newConflictCells.add(`${row}-${col}`);
          }
          const startRow = Math.floor(row / 3) * 3;
          const startCol = Math.floor(col / 3) * 3;
          for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
              const r = startRow + i;
              const c = startCol + j;
              if ((r !== row || c !== col) && board[r][c] === num) {
                newConflictCells.add(`${row}-${col}`);
              }
            }
          }
        }
      }
    }
    setConflictCells(newConflictCells);
  };

  //locking cells entered by user (used for solver button)
  const handleLock = () => {
    //navigating through all cells to ensure it is empty or filled by user
    const isUserFilled = board.every((row, rowIndex) =>
      row.every((cell, colIndex) => {
        const cellId = `${rowIndex}-${colIndex}`;
        return cell === null || (!generatedCells.has(cellId) && cell !== null);
      })
    );
  
    if (!isUserFilled) {
      alert('The lock feature can only be used on a user-filled grid without generated cells.');
      return;
    }
    //checking conflicts in user input
    const hasConflicts = board.some((row, rowIndex) =>
      row.some((cell, colIndex) => {
        if (cell === null) return false;
  
        if (row.filter((val) => val === cell).length > 1) return true;
  
        if (board.some((r, i) => r[colIndex] === cell && i !== rowIndex)) return true;
  
        const startRow = Math.floor(rowIndex / 3) * 3;
        const startCol = Math.floor(colIndex / 3) * 3;
        for (let r = startRow; r < startRow + 3; r++) {
          for (let c = startCol; c < startCol + 3; c++) {
            if ((r !== rowIndex || c !== colIndex) && board[r][c] === cell) {
              return true;
            }
          }
        }
  
        return false;
      })
    );
    if (hasConflicts) {
      alert('There are conflicts in the board. Please resolve them before locking cells.');
      return;
    }
    //checking if entered board is solvable
    const boardCopy = board.map(row => row.slice()); 
    if (!fillBoard(boardCopy)) {
      alert('The current board state is unsolvable. Please correct it before locking cells.');
      return;
    }
    //lock the cells entered by user
    const newLockedCells = new Set<string>();
    board.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellId = `${rowIndex}-${colIndex}`;
        if (cell !== null && !generatedCells.has(cellId)) {
          newLockedCells.add(cellId);
        }
      });
    });
  
    setLockedCells(newLockedCells);
    setStoredSolution(boardCopy);
    alert('Cells have been successfully locked and the board is solvable.');
  };
  
  //solves the sudoku board
  const solve = () => {
    if (!storedSolution) {
      alert('No solution available. Please generate or reset the puzzle.');
      return;
    }  
    //only providing solution when generated and locked cells available
    if (generatedCells.size === 0 && lockedCells.size === 0) {
      return;
    }
    const newBoard = board.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        const cellId = `${rowIndex}-${colIndex}`;
        if (
          !lockedCells.has(cellId) &&
          !generatedCells.has(cellId) &&
          cell !== storedSolution[rowIndex][colIndex]
        ) {
          return storedSolution[rowIndex][colIndex];
        }
        return cell;
      })
    );
    setBoard(newBoard);
  };
  
  
  //Reveals random numbers on the sudoku that would help user continue solving
  const provideHint = () => {
    if (!storedSolution) {
      alert('No solution available. Please generate or reset the puzzle.');
      return;
    }
    //only providing hints when generated and locked cells available
      if (generatedCells.size === 0 && lockedCells.size === 0) {  
      return;
    }
    if (hintLimit > 0) {
      const hintCandidates = [];
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const cellId = `${row}-${col}`;
          if (
            !lockedCells.has(cellId) &&
            !generatedCells.has(cellId) &&
            (board[row][col] === null || board[row][col] !== storedSolution[row][col])
          ) {
            hintCandidates.push([row, col]);
          }
        }
      }
      if (hintCandidates.length > 0) {
        const [row, col] = hintCandidates[Math.floor(Math.random() * hintCandidates.length)];
        const newBoard = board.map(r => r.slice());
        newBoard[row][col] = storedSolution[row][col];
        setBoard(newBoard);
        checkConflicts(newBoard);
        setHintLimit(prev => prev - 1);
      } 
      else {alert('No valid cells for hints! Ensure there are incorrect or empty cells.');}
    } 
    else {alert('No more hints available!');}
  };
  
  
  //checking user solution
  const checkSolution = () => {
    const solvedBoard = board.map(r => r.slice());
    if (fillBoard(solvedBoard) && JSON.stringify(board) === JSON.stringify(solvedBoard)) {
      alert('Solution is correct!');
    } 
    else {alert('Solution is incorrect!');}
  };

  //Handling file (image) upload and allowing future processing
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file) {
      const reader = new FileReader();  //convert image to base64 string to allow reading file content
      reader.onloadend = () => {
        if (reader.result) {
          setUploadedImage(reader.result as string);
          processImage(reader.result as string); 
        }
      };
      reader.readAsDataURL(file);  //read the image (file) as a base64 encoded string (to embed img data into web app)
      e.target.value = "";
    }
  };

  //process uploaded image to detct a sudoku inside
  const processImage = async (imageData: string) => {
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
  const cropImage = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
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

  //validate board detected by ocr
  const isValidSudokuBoard = (board: Board): boolean => {
    return (
      board.length === 9 && board.every((row) => row.length === 9) &&
      board.flat().every((cell) => cell === null || (cell >= 1 && cell <= 9))
    );
  };  

  //Calculate threshold (method: Otsu)
  const calculateOtsuThreshold = (imageData: ImageData): number => {
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
  const segmentSudokuGrid = (canvas: HTMLCanvasElement): HTMLCanvasElement[] => {
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
  
  //modal to include image preview
  const togglePreviewModal = () => { setPreviewModalOpen(!previewModalOpen); };   


  return (
    <div className="sudoku-container">
      <div className="buttons-container">
        <button onClick={checkSolution}>Check Solution</button>
        <button onClick={solve}>Solve</button>
        <div className="hint-container">
          {hintLimit > 0 && <div className="hint-bubble">{hintLimit}</div>}
          <button onClick={provideHint}>Hint</button>
        </div>
        <button className="Reset" onClick={handleReset}>Reset</button>
      </div>

      <div className="buttons-container">        
        <label>Difficulty:</label>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <button onClick={generateNewPuzzle}>Generate</button>
        <button onClick={handleLock} className="Solver"
            title="Fill the grid with your own Sudoku, lock it by pressing this button, and solve it!">
            Solver</button>
      </div>

      <div className="buttons-container">
        <label className="upload-button">
          <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e)} disabled={ocrInProgress}  style={{ display: 'none' }}
            />
            {ocrInProgress ? 'Processing...' : 'Upload Image'}
        </label>
        <button onClick={togglePreviewModal} disabled={!uploadedImage}>
          Preview Image
        </button>        </div>
      <div className="sudoku-grid">
        {Array.from({ length: 9 }).map((_, index) => {
          const boxRow = Math.floor(index / 3);
          const boxCol = index % 3;
          return (
            <div className="sudoku-box" key={index}>
              {board.slice(boxRow * 3, boxRow * 3 + 3).map((row, rowIndex) => {
                return row
                  .slice(boxCol * 3, boxCol * 3 + 3)
                  .map((cell, colIndex) => {
                    const actualRow = boxRow * 3 + rowIndex;
                    const actualCol = boxCol * 3 + colIndex;
                    const cellId = `${actualRow}-${actualCol}`;
                    const isConflict = conflictCells.has(cellId);
                    const isGenerated = generatedCells.has(cellId);
                    return (
                      <input
                        id={cellId}
                        key={cellId}
                        className={`sudoku-cell ${isConflict ? 'conflict' : ''} ${isGenerated || lockedCells.has(cellId) ? 'generated' : ''}`}
                        type="text"
                        value={cell === null ? '' : cell.toString()}
                        readOnly={isGenerated || lockedCells.has(cellId)}
                        onChange={(e) => handleInputChange(e.target.value, actualRow, actualCol)}
                        onClick={() => setSelectedCell({ row: actualRow, col: actualCol })} 
                      />
                    );
                  });
              })}
            </div>
          );
        })}
      </div>

      {previewModalOpen && uploadedImage && (
        <div className="modal-overlay" onClick={togglePreviewModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={uploadedImage} alt="Uploaded Preview" className="modal-image" />
            <button className="close-modal" onClick={togglePreviewModal}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>  
  );
};

export default Sudoku;