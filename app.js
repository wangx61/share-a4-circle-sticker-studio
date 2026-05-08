// === CONSTANTS ===
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MAX_PAGES = 100;
const MAX_IMAGES = 100;
const PIXELS_PER_MM = 3.7795275591;

// === LAYOUT DEFINITIONS ===
const LAYOUTS = {
    style1: {
        id: 'style1',
        label: '样式一 (10mm)',
        cols: 17,
        rows: 24,
        diameter: 10,
        bgDiameter: 11,
        gap: 2,
        gapH: 2,
        gapV: 2,
        marginLeft: 4,
        marginTop: 5,
        description: '24行 x 17列，直径10mm'
    },
    style2: {
        id: 'style2',
        label: '样式二 (16mm)',
        cols: 11,
        rows: 16,
        diameter: 16,
        bgDiameter: 17,
        gap: 2,
        gapH: 2,
        gapV: 2,
        marginLeft: 7.6,
        marginTop: 5.5,
        description: '16行 x 11列，直径16mm'
    },
    style3: {
        id: 'style3',
        label: '样式三 (20mm)',
        cols: 9,
        rows: 12,
        diameter: 20,
        bgDiameter: 21,
        gap: 1,
        gapH: 1,
        gapV: 2,
        marginLeft: 12,
        marginTop: 18,
        description: '12行 x 9列，直径20mm'
    }
};

// === CUSTOM LAYOUT ===
function computeCustomLayout(config) {
    const availW = config.pageWidth - config.marginLeft - config.marginRight;
    const availH = config.pageHeight - config.marginTop - config.marginBottom;
    const gapH = config.cols > 1 ? (availW - config.cols * config.diameter) / (config.cols - 1) : 0;
    const gapV = config.rows > 1 ? (availH - config.rows * config.diameter) / (config.rows - 1) : 0;
    return {
        id: 'custom',
        label: '样式四 (自定义)',
        cols: config.cols,
        rows: config.rows,
        diameter: config.diameter,
        bgDiameter: config.diameter + 1,
        gapH: gapH,
        gapV: gapV,
        marginLeft: config.marginLeft,
        marginTop: config.marginTop,
        pageWidth: config.pageWidth,
        pageHeight: config.pageHeight,
        description: `${config.rows}行 × ${config.cols}列，直径${config.diameter}mm`
    };
}

function getPageWidth() { return state.currentLayout.pageWidth || A4_WIDTH_MM; }
function getPageHeight() { return state.currentLayout.pageHeight || A4_HEIGHT_MM; }

// === FILL MODES ===
const FillMode = { Single: 'Single', Row: 'Row', Column: 'Column', Page: 'Page' };
const BoxSelectMode = { Off: 'Off', Fill: 'Fill', Delete: 'Delete' };
const ActiveTab = { Image: 'Image', Background: 'Background', Page: 'Page' };

// === STATE ===
let state = {
    pages: [createEmptyPage()],
    currentPageIndex: 0,
    uploadedImages: [],
    processedImages: [],
    selectedImageId: null,
    selectedColor: { c: 0, m: 0, y: 0, k: 0 },
    activeTab: ActiveTab.Image,
    boxSelectMode: BoxSelectMode.Off,
    scale: 1.0,
    currentLayout: LAYOUTS.style1,
    history: [],
    future: [],
    cropTargetId: null,
    isExportMenuOpen: false,
    isExporting: false,
    // Offset for pattern position adjustment (single X and Y values)
    offsetX: 0,  // positive = left, negative = right
    offsetY: 0,   // positive = up, negative = down
    // Custom layout configuration
    customConfig: {
        pageWidth: 210,
        pageHeight: 297,
        marginTop: 5,
        marginBottom: 5,
        marginLeft: 4,
        marginRight: 4,
        diameter: 10,
        cols: 10,
        rows: 10
    },
    isCustomLayout: false
};

// Cropper state
let cropperState = {
    scale: 1,
    position: { x: 0, y: 0 },
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    imgRef: null
};

// Selection box state
let selectionState = {
    isSelecting: false,
    startPoint: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 }
};

// === UTILITY FUNCTIONS ===
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function createEmptyPage() {
    return { id: generateId(), cells: {} };
}

function cmykToRgbString(cmyk) {
    const r = 255 * (1 - cmyk.c / 100) * (1 - cmyk.k / 100);
    const g = 255 * (1 - cmyk.m / 100) * (1 - cmyk.k / 100);
    const b = 255 * (1 - cmyk.y / 100) * (1 - cmyk.k / 100);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function cmykToHex(cmyk) {
    const r = Math.round(255 * (1 - cmyk.c / 100) * (1 - cmyk.k / 100));
    const g = Math.round(255 * (1 - cmyk.m / 100) * (1 - cmyk.k / 100));
    const b = Math.round(255 * (1 - cmyk.y / 100) * (1 - cmyk.k / 100));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToCmyk(r, g, b) {
    let c = 1 - (r / 255);
    let m = 1 - (g / 255);
    let y = 1 - (b / 255);
    let k = Math.min(c, Math.min(m, y));

    c = (c - k) / (1 - k);
    m = (m - k) / (1 - k);
    y = (y - k) / (1 - k);

    c = isNaN(c) ? 0 : c;
    m = isNaN(m) ? 0 : m;
    y = isNaN(y) ? 0 : y;
    k = isNaN(k) ? 0 : k;

    return {
        c: Math.round(c * 100),
        m: Math.round(m * 100),
        y: Math.round(y * 100),
        k: Math.round(k * 100)
    };
}

function getCellCoordinates(row, col, layout) {
    const gapH = layout.gapH || layout.gap;
    const gapV = layout.gapV || layout.gap;
    // Apply offset: positive X = left, positive Y = up
    const x = layout.marginLeft + col * (layout.diameter + gapH) + state.offsetX;
    const y = layout.marginTop + row * (layout.diameter + gapV) + state.offsetY;
    return { x, y };
}

function isCellInBox(row, col, box, layout) {
    const { x, y } = getCellCoordinates(row, col, layout);
    const r = layout.diameter / 2;
    const cx = x + r;
    const cy = y + r;
    const minX = Math.min(box.startX, box.endX);
    const maxX = Math.max(box.startX, box.endX);
    const minY = Math.min(box.startY, box.endY);
    const maxY = Math.max(box.startY, box.endY);
    return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
}

function hasPageContent(page) {
    return Object.values(page.cells).some(c => c.imageId || c.bgColor);
}

// === HISTORY ===
function saveHistory() {
    state.history.push(JSON.parse(JSON.stringify(state.pages)));
    state.history = state.history.slice(-20);
    state.future = [];
}

function handleUndo() {
    if (state.history.length === 0) return;
    const previous = state.history.pop();
    state.future.unshift(state.pages);
    state.pages = previous;
    renderAll();
}

function handleRedo() {
    if (state.future.length === 0) return;
    const next = state.future.shift();
    state.history.push(state.pages);
    state.pages = next;
    renderAll();
}

// === PAGE OPERATIONS ===
function updatePageCells(pageIndex, newCells) {
    state.pages[pageIndex] = {
        ...state.pages[pageIndex],
        cells: { ...state.pages[pageIndex].cells, ...newCells }
    };
    renderAll();
}

function selectPage(idx) {
    state.currentPageIndex = idx;
    renderAll();
}

function addPage() {
    if (state.pages.length < MAX_PAGES) {
        saveHistory();
        state.pages.push(createEmptyPage());
        state.currentPageIndex = state.pages.length - 1;
        renderAll();
    }
}

function deletePage(idx) {
    if (state.pages.length <= 1) return;
    saveHistory();
    state.pages.splice(idx, 1);
    if (state.currentPageIndex >= idx && state.currentPageIndex > 0) {
        state.currentPageIndex--;
    }
    renderAll();
}

// === IMAGE UPLOAD & PROCESSING ===
function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (state.uploadedImages.length + files.length > MAX_IMAGES) {
        alert(`最多允许上传 ${MAX_IMAGES} 张图片。`);
        return;
    }
    const newImages = files.map(file => ({
        id: generateId(),
        url: URL.createObjectURL(file)
    }));
    state.uploadedImages.push(...newImages);
    if (!state.cropTargetId && newImages.length > 0) {
        state.cropTargetId = newImages[0].id;
    }
    renderUploadedList();
    updateUploadCount();
    updateCropper();
}

function selectUploadedImage(id) {
    state.cropTargetId = id;
    renderUploadedList();
    updateCropper();
}

function handleCropConfirm() {
    const canvas = document.getElementById('cropper-canvas');
    const dataUrl = canvas.toDataURL('image/png');
    const newImage = { id: generateId(), url: dataUrl };
    state.processedImages.push(newImage);
    state.selectedImageId = newImage.id;
    state.activeTab = ActiveTab.Image;
    renderAll();
}

function selectProcessedImage(id) {
    state.selectedImageId = id;
    state.activeTab = ActiveTab.Image;
    renderAll();
}

function deleteProcessedImage(id) {
    state.processedImages = state.processedImages.filter(img => img.id !== id);
    if (state.selectedImageId === id) {
        state.selectedImageId = null;
    }
    renderProcessedGrid();
}

// === CROPPER ===
function updateCropper() {
    const canvas = document.getElementById('cropper-canvas');
    const image = state.uploadedImages.find(u => u.id === state.cropTargetId);

    if (!image) {
        // Clear canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 300, 300);
        cropperState.imgRef = null;
        return;
    }

    const img = new Image();
    img.src = image.url;
    img.onload = () => {
        cropperState.imgRef = img;
        cropperState.scale = 1;
        cropperState.position = { x: 0, y: 0 };
        drawCropper();
    };
}

function drawCropper() {
    const canvas = document.getElementById('cropper-canvas');
    const img = cropperState.imgRef;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    const size = 300;

    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2 + cropperState.position.x, size / 2 + cropperState.position.y);
    ctx.scale(cropperState.scale, cropperState.scale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
}

function initCropperEvents() {
    const circle = document.getElementById('cropper-circle');
    const scaleSlider = document.getElementById('crop-scale');
    const scaleValue = document.getElementById('scale-value');

    circle.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY * -0.001;
        cropperState.scale = Math.min(Math.max(0.01, cropperState.scale + delta), 10);
        scaleSlider.value = cropperState.scale;
        scaleValue.textContent = cropperState.scale.toFixed(2) + 'x';
        drawCropper();
    });

    circle.addEventListener('mousedown', (e) => {
        cropperState.isDragging = true;
        cropperState.dragStart = {
            x: e.clientX - cropperState.position.x,
            y: e.clientY - cropperState.position.y
        };
    });

    document.addEventListener('mousemove', (e) => {
        if (cropperState.isDragging) {
            cropperState.position = {
                x: e.clientX - cropperState.dragStart.x,
                y: e.clientY - cropperState.dragStart.y
            };
            drawCropper();
        }
    });

    document.addEventListener('mouseup', () => {
        cropperState.isDragging = false;
    });

    scaleSlider.addEventListener('input', (e) => {
        cropperState.scale = parseFloat(e.target.value);
        scaleValue.textContent = cropperState.scale.toFixed(2) + 'x';
        drawCropper();
    });

    document.getElementById('crop-confirm').addEventListener('click', handleCropConfirm);
}

// === COLOR PICKER ===
function updateColorPreview() {
    const preview = document.getElementById('color-preview');
    preview.style.backgroundColor = cmykToRgbString(state.selectedColor);
}

function updateColorInputs() {
    ['c', 'm', 'y', 'k'].forEach(channel => {
        document.getElementById(`${channel}-slider`).value = state.selectedColor[channel];
        document.getElementById(`${channel}-input`).value = state.selectedColor[channel];
    });
    updateColorPreview();
}

function handleColorChange(channel, value) {
    state.selectedColor[channel] = Math.min(100, Math.max(0, parseInt(value) || 0));
    updateColorInputs();
}

function handleEyeDropper() {
    if (!window.EyeDropper) {
        alert('您的浏览器不支持吸色功能 (EyeDropper API)。请尝试使用 Chrome 或 Edge 浏览器。');
        return;
    }
    try {
        const eyeDropper = new EyeDropper();
        eyeDropper.open().then(result => {
            const hex = result.sRGBHex;
            const rgb = hexToRgb(hex);
            if (rgb) {
                state.selectedColor = rgbToCmyk(rgb.r, rgb.g, rgb.b);
                updateColorInputs();
            }
        }).catch(() => {
            console.log('User canceled color selection');
        });
    } catch (e) {
        console.log('EyeDropper error:', e);
    }
}

function initColorPicker() {
    ['c', 'm', 'y', 'k'].forEach(channel => {
        document.getElementById(`${channel}-slider`).addEventListener('input', (e) => {
            handleColorChange(channel, e.target.value);
        });
        document.getElementById(`${channel}-input`).addEventListener('input', (e) => {
            handleColorChange(channel, e.target.value);
        });
    });
    document.getElementById('eye-dropper').addEventListener('click', handleEyeDropper);
    updateColorInputs();
}

// === FILL OPERATIONS ===
function getFillTarget() {
    return state.activeTab === ActiveTab.Background ? 'color' : 'image';
}

function applyCellChange(r, c, isDelete, cellsAcc) {
    const key = `${r}-${c}`;
    const current = cellsAcc[key] || { row: r, col: c };
    const fillType = getFillTarget();

    if (isDelete) {
        if (fillType === 'image') current.imageId = undefined;
        else current.bgColor = undefined;
    } else {
        if (fillType === 'image') {
            if (!state.selectedImageId) return;
            current.imageId = state.selectedImageId;
        } else {
            current.bgColor = { ...state.selectedColor };
        }
    }
    cellsAcc[key] = current;
}

function fillSingle(r, c, isDelete = false) {
    if (state.activeTab === ActiveTab.Page) return;
    saveHistory();
    const cells = { ...state.pages[state.currentPageIndex].cells };
    applyCellChange(r, c, isDelete, cells);
    updatePageCells(state.currentPageIndex, cells);
}

function fillPage(pageIdx, isDelete = false) {
    if (state.activeTab === ActiveTab.Page) return;
    saveHistory();
    const cells = { ...state.pages[pageIdx].cells };
    const fillType = getFillTarget();

    for (let r = 0; r < state.currentLayout.rows; r++) {
        for (let c = 0; c < state.currentLayout.cols; c++) {
            if (!isDelete) {
                const key = `${r}-${c}`;
                const currentCell = cells[key];
                const isOccupied = fillType === 'image' ? currentCell?.imageId : currentCell?.bgColor;
                if (!isOccupied) {
                    applyCellChange(r, c, false, cells);
                }
            } else {
                applyCellChange(r, c, true, cells);
            }
        }
    }
    updatePageCells(pageIdx, cells);

    if (!isDelete && pageIdx === state.pages.length - 1 && state.pages.length < MAX_PAGES) {
        state.pages.push(createEmptyPage());
        renderAll();
    }
}

function fillNextEmpty() {
    saveHistory();
    let pIdx = state.currentPageIndex;
    let found = false;
    let targetR = -1, targetC = -1;
    const fillType = getFillTarget();

    for (let r = 0; r < state.currentLayout.rows; r++) {
        for (let c = 0; c < state.currentLayout.cols; c++) {
            const cell = state.pages[pIdx].cells[`${r}-${c}`];
            const isOccupied = fillType === 'image' ? cell?.imageId : cell?.bgColor;
            if (!isOccupied) {
                targetR = r;
                targetC = c;
                found = true;
                break;
            }
        }
        if (found) break;
    }

    if (found) {
        const cells = { ...state.pages[pIdx].cells };
        applyCellChange(targetR, targetC, false, cells);
        updatePageCells(pIdx, cells);

        const isPageFull = Object.keys(cells).filter(k => {
            const c = cells[k];
            return fillType === 'image' ? c.imageId : c.bgColor;
        }).length === state.currentLayout.rows * state.currentLayout.cols;

        if (isPageFull && pIdx === state.pages.length - 1 && state.pages.length < MAX_PAGES) {
            state.pages.push(createEmptyPage());
            renderAll();
        }
    } else if (state.pages.length < MAX_PAGES) {
        state.pages.push(createEmptyPage());
        state.currentPageIndex++;
        renderAll();
    }
}

function fillRowSmart() {
    saveHistory();
    const pIdx = state.currentPageIndex;
    let targetRow = -1;
    const fillType = getFillTarget();

    for (let r = 0; r < state.currentLayout.rows; r++) {
        let hasEmpty = false;
        for (let c = 0; c < state.currentLayout.cols; c++) {
            const cell = state.pages[pIdx].cells[`${r}-${c}`];
            const isOccupied = fillType === 'image' ? cell?.imageId : cell?.bgColor;
            if (!isOccupied) {
                hasEmpty = true;
                break;
            }
        }
        if (hasEmpty) {
            targetRow = r;
            break;
        }
    }

    if (targetRow !== -1) {
        const cells = { ...state.pages[pIdx].cells };
        for (let c = 0; c < state.currentLayout.cols; c++) {
            const cell = state.pages[pIdx].cells[`${targetRow}-${c}`];
            const isOccupied = fillType === 'image' ? cell?.imageId : cell?.bgColor;
            if (!isOccupied) applyCellChange(targetRow, c, false, cells);
        }
        updatePageCells(pIdx, cells);
    }
}

function deleteLastItem() {
    saveHistory();
    const pIdx = state.currentPageIndex;
    let targetR = -1, targetC = -1;
    let found = false;
    const fillType = getFillTarget();

    for (let r = state.currentLayout.rows - 1; r >= 0; r--) {
        for (let c = state.currentLayout.cols - 1; c >= 0; c--) {
            const cell = state.pages[pIdx].cells[`${r}-${c}`];
            const isOccupied = fillType === 'image' ? cell?.imageId : cell?.bgColor;
            if (isOccupied) {
                targetR = r;
                targetC = c;
                found = true;
                break;
            }
        }
        if (found) break;
    }

    if (found) {
        const cells = { ...state.pages[pIdx].cells };
        applyCellChange(targetR, targetC, true, cells);
        updatePageCells(pIdx, cells);
    }
}

function deleteRowSmart() {
    saveHistory();
    const pIdx = state.currentPageIndex;
    let targetRow = -1;
    const fillType = getFillTarget();

    for (let r = state.currentLayout.rows - 1; r >= 0; r--) {
        let hasContent = false;
        for (let c = 0; c < state.currentLayout.cols; c++) {
            const cell = state.pages[pIdx].cells[`${r}-${c}`];
            const isOccupied = fillType === 'image' ? cell?.imageId : cell?.bgColor;
            if (isOccupied) {
                hasContent = true;
                break;
            }
        }
        if (hasContent) {
            targetRow = r;
            break;
        }
    }

    if (targetRow !== -1) {
        const cells = { ...state.pages[pIdx].cells };
        for (let c = 0; c < state.currentLayout.cols; c++) {
            applyCellChange(targetRow, c, true, cells);
        }
        updatePageCells(pIdx, cells);
    }
}

// === BOX SELECTION ===
function handleBoxSelection(selectedCells, mode) {
    if (mode === BoxSelectMode.Off) return;
    saveHistory();
    const isDelete = mode === BoxSelectMode.Delete;
    const cells = { ...state.pages[state.currentPageIndex].cells };
    selectedCells.forEach(({ row, col }) => {
        applyCellChange(row, col, isDelete, cells);
    });
    updatePageCells(state.currentPageIndex, cells);
}

// === RENDER FUNCTIONS ===
function renderUploadedList() {
    const grid = document.getElementById('uploaded-grid');
    grid.innerHTML = '';

    state.uploadedImages.forEach(img => {
        const item = document.createElement('div');
        item.className = 'image-grid-item' + (state.cropTargetId === img.id ? ' selected' : '');
        item.innerHTML = `<img src="${img.url}" alt="">`;
        item.addEventListener('click', () => selectUploadedImage(img.id));
        grid.appendChild(item);
    });
}

function updateUploadCount() {
    document.getElementById('upload-count').textContent = `${state.uploadedImages.length}/100`;
}

function renderProcessedGrid() {
    const grid = document.getElementById('processed-grid');
    grid.innerHTML = '';

    state.processedImages.forEach(img => {
        const item = document.createElement('div');
        item.className = 'processed-item';
        item.innerHTML = `
            <div class="processed-item-inner${state.selectedImageId === img.id ? ' selected' : ''}">
                <img src="${img.url}" alt="">
            </div>
            <button class="processed-delete">×</button>
        `;
        item.querySelector('.processed-item-inner').addEventListener('click', () => selectProcessedImage(img.id));
        item.querySelector('.processed-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteProcessedImage(img.id);
        });
        grid.appendChild(item);
    });
}

function renderLayoutOptions() {
    const container = document.getElementById('layout-options');
    container.innerHTML = '';

    const layouts = [...Object.values(LAYOUTS)];
    // Add custom layout option
    const customLayout = computeCustomLayout(state.customConfig);
    layouts.push(customLayout);

    const isCustom = state.isCustomLayout;
    // Ensure custom panel visibility matches state
    const customPanel = document.getElementById('custom-layout-panel');
    if (customPanel) {
        customPanel.classList.toggle('hidden', !isCustom);
    }

    layouts.forEach(layout => {
        const isActive = layout.id === 'custom' ? isCustom : (!isCustom && state.currentLayout.id === layout.id);
        const option = document.createElement('div');
        option.className = 'layout-option' + (isActive ? ' active' : '');
        option.innerHTML = `
            <div class="layout-option-header">
                <span class="layout-option-title">${layout.label}</span>
                ${isActive ? '<div class="layout-option-badge"></div>' : ''}
            </div>
            <p class="layout-option-desc">${layout.description}</p>
        `;
        option.addEventListener('click', () => {
            if (layout.id === 'custom') {
                state.isCustomLayout = true;
                state.currentLayout = customLayout;
                document.getElementById('custom-layout-panel').classList.remove('hidden');
            } else {
                state.isCustomLayout = false;
                state.currentLayout = layout;
                document.getElementById('custom-layout-panel').classList.add('hidden');
            }
            renderLayoutOptions();
            updateSheetSize();
            renderGrid();
            renderThumbnails();
        });
        container.appendChild(option);
    });
}

function renderGrid() {
    const container = document.getElementById('grid-container');
    container.innerHTML = '';

    const imageMap = new Map(state.processedImages.map(img => [img.id, img.url]));

    for (let r = 0; r < state.currentLayout.rows; r++) {
        for (let c = 0; c < state.currentLayout.cols; c++) {
            const { x, y } = getCellCoordinates(r, c, state.currentLayout);
            const key = `${r}-${c}`;
            const cell = state.pages[state.currentPageIndex].cells[key];

            const cellDiv = document.createElement('div');
            cellDiv.className = 'grid-cell';
            cellDiv.style.left = `${x}mm`;
            cellDiv.style.top = `${y}mm`;
            cellDiv.style.width = `${state.currentLayout.diameter}mm`;
            cellDiv.style.height = `${state.currentLayout.diameter}mm`;
            cellDiv.dataset.row = r;
            cellDiv.dataset.col = c;

            if (cell?.bgColor) {
                const bgDiv = document.createElement('div');
                bgDiv.className = 'grid-cell-bg';
                bgDiv.style.left = `-0.5mm`;
                bgDiv.style.top = `-0.5mm`;
                bgDiv.style.width = `${state.currentLayout.bgDiameter}mm`;
                bgDiv.style.height = `${state.currentLayout.bgDiameter}mm`;
                bgDiv.style.backgroundColor = cmykToRgbString(cell.bgColor);
                cellDiv.appendChild(bgDiv);
            }

            const circleDiv = document.createElement('div');
            circleDiv.className = 'grid-cell-circle';

            if (cell?.imageId && imageMap.has(cell.imageId)) {
                const img = document.createElement('img');
                img.className = 'grid-cell-image';
                img.src = imageMap.get(cell.imageId);
                circleDiv.appendChild(img);
            }

            circleDiv.addEventListener('click', (e) => {
                if (state.boxSelectMode !== BoxSelectMode.Off) return;
                e.stopPropagation();
                fillSingle(r, c);
            });

            cellDiv.appendChild(circleDiv);
            container.appendChild(cellDiv);
        }
    }
}

function renderThumbnails() {
    const list = document.getElementById('thumbnail-list');
    list.innerHTML = '';
    document.querySelector('.thumbnail-title').textContent = `页面概览 (${state.pages.length})`;

    const imageMap = new Map(state.processedImages.map(img => [img.id, img.url]));

    state.pages.forEach((page, idx) => {
        const item = document.createElement('div');
        item.className = 'thumbnail-item';
        item.innerHTML = `
            <div class="thumbnail-inner${idx === state.currentPageIndex ? ' active' : ''}" style="aspect-ratio: ${getPageWidth()} / ${getPageHeight()}">
                <div class="thumbnail-content">
                    ${renderThumbnailCells(page, imageMap)}
                </div>
                <span class="thumbnail-page-num">${idx + 1}</span>
                ${hasPageContent(page) ? '<div class="thumbnail-content-badge"></div>' : ''}
            </div>
            ${state.pages.length > 1 ? '<button class="thumbnail-delete">×</button>' : ''}
        `;
        item.querySelector('.thumbnail-inner').addEventListener('click', () => selectPage(idx));
        const deleteBtn = item.querySelector('.thumbnail-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deletePage(idx);
            });
        }
        list.appendChild(item);
    });
}

function renderThumbnailCells(page, imageMap) {
    let html = '';
    const maxCells = Math.min(state.currentLayout.cols * state.currentLayout.rows, 50);

    for (let i = 0; i < maxCells; i++) {
        const r = Math.floor(i / state.currentLayout.cols);
        const c = i % state.currentLayout.cols;
        const cell = page.cells[`${r}-${c}`];

        if (cell) {
            const bgColor = cell.bgColor ? cmykToRgbString(cell.bgColor) : (cell.imageId ? '#3b82f6' : 'transparent');
            html += `<div class="thumbnail-cell" style="left: ${(c / state.currentLayout.cols) * 100}%; top: ${(r / state.currentLayout.rows) * 100}%; background: ${bgColor}"></div>`;
        }
    }
    return html;
}

function updateSheetSize() {
    const sheet = document.getElementById('a4-sheet');
    const w = getPageWidth();
    const h = getPageHeight();
    sheet.style.width = `${w}mm`;
    sheet.style.height = `${h}mm`;
}

function updateScale() {
    const sheet = document.getElementById('a4-sheet');
    sheet.style.transform = `scale(${state.scale})`;
    document.getElementById('scale-input').value = Math.round(state.scale * 100);
}

function updateFillLabel() {
    const label = document.getElementById('fill-label');
    label.textContent = state.activeTab === ActiveTab.Background ? '填充底色:' : '填充图片:';
}

function updatePageInfo() {
    document.getElementById('page-info').textContent = `第 ${state.currentPageIndex + 1} 页 / 共 ${state.pages.length} 页`;
}

function renderAll() {
    renderUploadedList();
    updateUploadCount();
    updateCropper();
    renderProcessedGrid();
    updateColorInputs();
    updateSheetSize();
    renderLayoutOptions();
    renderGrid();
    renderThumbnails();
    updateScale();
    updateFillLabel();
    updatePageInfo();
    updateToolbarButtons();
    updateTabButtons();
    updateBoxSelectButtons();
}

// === TAB SWITCHING ===
function switchTab(tab) {
    state.activeTab = tab;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab.toLowerCase());
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tab.toLowerCase()}`);
    });

    updateFillLabel();
}

function updateTabButtons() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === state.activeTab.toLowerCase());
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${state.activeTab.toLowerCase()}`);
    });
}

// === OFFSET CONTROL ===
function updateOffsetPreview() {
    // Update the visual indicator in the preview box
    const indicator = document.getElementById('offset-grid-indicator');
    if (indicator) {
        // Scale offset to preview box (preview box is 140x198, A4 is 210x297)
        // Offset range: -50 to +50 mm, preview range: about 40px movement
        const scaleX = 140 / 210;  // 0.667
        const scaleY = 198 / 297;  // 0.667
        const maxOffsetPreview = 20;  // max pixels to move in preview

        const visualX = Math.max(-maxOffsetPreview, Math.min(maxOffsetPreview, state.offsetX * scaleX * 0.4));
        const visualY = Math.max(-maxOffsetPreview, Math.min(maxOffsetPreview, state.offsetY * scaleY * 0.4));

        indicator.style.left = `calc(10% + ${visualX}px)`;
        indicator.style.top = `calc(10% + ${-visualY}px)`;
    }
}

function updateOffsetInputs() {
    document.getElementById('offset-x').value = state.offsetX.toFixed(1);
    document.getElementById('offset-y').value = state.offsetY.toFixed(1);
    updateOffsetPreview();
}

function handleOffsetChange(axis, value) {
    // Parse value with 0.1mm precision
    const parsedValue = parseFloat(value);
    if (axis === 'x') {
        state.offsetX = isNaN(parsedValue) ? 0 : Math.max(-50, Math.min(50, parsedValue));
    } else {
        state.offsetY = isNaN(parsedValue) ? 0 : Math.max(-50, Math.min(50, parsedValue));
    }
    updateOffsetInputs();
    renderGrid();
    renderThumbnails();
}

function adjustOffset(axis, delta) {
    if (axis === 'x') {
        state.offsetX = Math.max(-50, Math.min(50, state.offsetX + delta));
    } else {
        state.offsetY = Math.max(-50, Math.min(50, state.offsetY + delta));
    }
    updateOffsetInputs();
    renderGrid();
    renderThumbnails();
}

function resetOffset() {
    state.offsetX = 0;
    state.offsetY = 0;
    updateOffsetInputs();
    renderGrid();
    renderThumbnails();
}

function initOffsetControl() {
    const toggleBtn = document.getElementById('offset-toggle');
    const offsetPanel = document.getElementById('offset-panel');

    toggleBtn.addEventListener('click', () => {
        const isHidden = offsetPanel.classList.contains('hidden');
        offsetPanel.classList.toggle('hidden');
        toggleBtn.textContent = isHidden ? '收起设置' : '展开设置';
        toggleBtn.classList.toggle('active', isHidden);
    });

    // Arrow buttons on preview box (each click = 0.1mm)
    document.getElementById('arrow-up').addEventListener('click', () => adjustOffset('y', 0.1));
    document.getElementById('arrow-down').addEventListener('click', () => adjustOffset('y', -0.1));
    document.getElementById('arrow-left').addEventListener('click', () => adjustOffset('x', 0.1));
    document.getElementById('arrow-right').addEventListener('click', () => adjustOffset('x', -0.1));

    // Value adjustment buttons (+ and −)
    document.getElementById('offset-x-decrease').addEventListener('click', () => adjustOffset('x', -0.1));
    document.getElementById('offset-x-increase').addEventListener('click', () => adjustOffset('x', 0.1));
    document.getElementById('offset-y-decrease').addEventListener('click', () => adjustOffset('y', -0.1));
    document.getElementById('offset-y-increase').addEventListener('click', () => adjustOffset('y', 0.1));

    // Manual input
    document.getElementById('offset-x').addEventListener('input', (e) => handleOffsetChange('x', e.target.value));
    document.getElementById('offset-x').addEventListener('change', (e) => handleOffsetChange('x', e.target.value));
    document.getElementById('offset-y').addEventListener('input', (e) => handleOffsetChange('y', e.target.value));
    document.getElementById('offset-y').addEventListener('change', (e) => handleOffsetChange('y', e.target.value));

    // Reset button
    document.getElementById('offset-reset').addEventListener('click', resetOffset);

    // Initialize display
    updateOffsetInputs();
}

// === BOX SELECT MODE ===
function setBoxSelectMode(mode) {
    state.boxSelectMode = mode;
    updateBoxSelectButtons();
}

function updateBoxSelectButtons() {
    document.getElementById('box-fill').classList.toggle('active', state.boxSelectMode === BoxSelectMode.Fill);
    document.getElementById('box-delete').classList.toggle('active', state.boxSelectMode === BoxSelectMode.Delete);
    document.getElementById('box-off').classList.toggle('active', state.boxSelectMode === BoxSelectMode.Off);
}

// === TOOLBAR BUTTONS ===
function updateToolbarButtons() {
    document.getElementById('undo-btn').disabled = state.history.length === 0;
    document.getElementById('redo-btn').disabled = state.future.length === 0;
}

// === CANVAS INTERACTION ===
function initCanvasEvents() {
    const container = document.getElementById('grid-container');
    const selectionBox = document.getElementById('selection-box');

    const getMmCoordinates = (e) => {
        const rect = container.getBoundingClientRect();
        const pixelX = e.clientX - rect.left;
        const pixelY = e.clientY - rect.top;
        return {
            x: pixelX / (PIXELS_PER_MM * state.scale),
            y: pixelY / (PIXELS_PER_MM * state.scale)
        };
    };

    container.addEventListener('mousedown', (e) => {
        if (state.boxSelectMode === BoxSelectMode.Off) return;

        selectionState.isSelecting = true;
        const coords = getMmCoordinates(e);
        selectionState.startPoint = coords;
        selectionState.currentPoint = coords;

        selectionBox.classList.remove('hidden');
        selectionBox.classList.toggle('delete-mode', state.boxSelectMode === BoxSelectMode.Delete);
    });

    container.addEventListener('mousemove', (e) => {
        if (!selectionState.isSelecting) return;

        selectionState.currentPoint = getMmCoordinates(e);

        const minX = Math.min(selectionState.startPoint.x, selectionState.currentPoint.x);
        const minY = Math.min(selectionState.startPoint.y, selectionState.currentPoint.y);
        const width = Math.abs(selectionState.currentPoint.x - selectionState.startPoint.x);
        const height = Math.abs(selectionState.currentPoint.y - selectionState.startPoint.y);

        selectionBox.style.left = `${minX}mm`;
        selectionBox.style.top = `${minY}mm`;
        selectionBox.style.width = `${width}mm`;
        selectionBox.style.height = `${height}mm`;
    });

    container.addEventListener('mouseup', () => {
        if (!selectionState.isSelecting) return;

        selectionState.isSelecting = false;
        selectionBox.classList.add('hidden');

        const box = {
            startX: selectionState.startPoint.x,
            startY: selectionState.startPoint.y,
            endX: selectionState.currentPoint.x,
            endY: selectionState.currentPoint.y
        };

        const selectedCells = [];
        for (let r = 0; r < state.currentLayout.rows; r++) {
            for (let c = 0; c < state.currentLayout.cols; c++) {
                if (isCellInBox(r, c, box, state.currentLayout)) {
                    selectedCells.push({ row: r, col: c });
                }
            }
        }

        if (selectedCells.length > 0) {
            handleBoxSelection(selectedCells, state.boxSelectMode);
        }
    });

    container.addEventListener('mouseleave', () => {
        if (selectionState.isSelecting) {
            selectionState.isSelecting = false;
            selectionBox.classList.add('hidden');
        }
    });
}

// === SCALE CONTROLS ===
function initScaleControls() {
    const scaleInput = document.getElementById('scale-input');
    const scaleDown = document.getElementById('scale-down');
    const scaleUp = document.getElementById('scale-up');

    const updateScaleValue = (newScale) => {
        state.scale = Math.min(Math.max(0.2, newScale), 3);
        updateScale();
    };

    scaleDown.addEventListener('click', () => updateScaleValue(state.scale - 0.1));
    scaleUp.addEventListener('click', () => updateScaleValue(state.scale + 0.1));

    scaleInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val)) updateScaleValue(val / 100);
    });

    // Ctrl+wheel zoom on canvas
    document.getElementById('canvas-container').addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY * -0.001;
            updateScaleValue(state.scale + delta);
        }
    });
}

// === EXPORT FUNCTIONS ===
function exportToPdf() {
    if (!window.jspdf) { alert("PDF 组件未加载。"); return; }
    const { jsPDF } = window.jspdf;
    const pageW = getPageWidth();
    const pageH = getPageHeight();
    const doc = new jsPDF({ orientation: pageH >= pageW ? 'portrait' : 'landscape', unit: 'mm', format: [pageW, pageH] });
    const imageMap = new Map(state.processedImages.map(img => [img.id, img.url]));
    const radius = state.currentLayout.diameter / 2;
    const bgRadius = state.currentLayout.bgDiameter / 2;

    let addedPage = false;
    state.pages.forEach((page, pageIndex) => {
        if (!hasPageContent(page)) return;
        if (addedPage) doc.addPage();
        addedPage = true;

        for (let r = 0; r < state.currentLayout.rows; r++) {
            for (let c = 0; c < state.currentLayout.cols; c++) {
                const cell = page.cells[`${r}-${c}`];
                if (!cell) continue;
                const { x, y } = getCellCoordinates(r, c, state.currentLayout);
                if (cell.bgColor) {
                    doc.setFillColor(cmykToHex(cell.bgColor));
                    doc.circle(x + radius, y + radius, bgRadius, 'F');
                }
                if (cell.imageId && imageMap.has(cell.imageId)) {
                    doc.addImage(imageMap.get(cell.imageId), 'PNG', x, y, state.currentLayout.diameter, state.currentLayout.diameter);
                }
            }
        }
    });
    doc.save('stickers.pdf');
}

function generateSvgString(page) {
    const imageMap = new Map(state.processedImages.map(img => [img.id, img.url]));
    const radius = state.currentLayout.diameter / 2;
    const bgRadius = state.currentLayout.bgDiameter / 2;
    const pageW = getPageWidth();
    const pageH = getPageHeight();
    let svg = `<svg width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
    svg += `<rect width="100%" height="100%" fill="white"/>`;

    for (let r = 0; r < state.currentLayout.rows; r++) {
        for (let c = 0; c < state.currentLayout.cols; c++) {
            const cell = page.cells[`${r}-${c}`];
            if (!cell) continue;
            const { x, y } = getCellCoordinates(r, c, state.currentLayout);
            const cx = x + radius;
            const cy = y + radius;

            if (cell.bgColor) {
                svg += `<circle cx="${cx}" cy="${cy}" r="${bgRadius}" fill="${cmykToHex(cell.bgColor)}" />`;
            }
            if (cell.imageId && imageMap.has(cell.imageId)) {
                const clipId = `clip-${r}-${c}-${Math.random().toString(36).substr(2, 5)}`;
                svg += `<defs><clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${radius}" /></clipPath></defs>`;
                svg += `<image x="${x}" y="${y}" width="${state.currentLayout.diameter}" height="${state.currentLayout.diameter}" xlink:href="${imageMap.get(cell.imageId)}" clip-path="url(#${clipId})" />`;
            }
        }
    }
    svg += `</svg>`;
    return svg;
}

async function drawPageToCanvas(page) {
    const canvas = document.createElement('canvas');
    const dpi = 300;
    const mmToPx = (mm) => (mm / 25.4) * dpi;
    const pageW = getPageWidth();
    const pageH = getPageHeight();
    canvas.width = mmToPx(pageW);
    canvas.height = mmToPx(pageH);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const imageMap = new Map(state.processedImages.map(img => [img.id, img.url]));
    const radiusPx = mmToPx(state.currentLayout.diameter / 2);
    const bgRadiusPx = mmToPx(state.currentLayout.bgDiameter / 2);

    const drawImage = (url, x, y, w, h) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + w/2, y + h/2, w/2, 0, 2 * Math.PI);
            ctx.clip();
            ctx.drawImage(img, x, y, w, h);
            ctx.restore();
            resolve();
        };
        img.onerror = resolve;
        img.src = url;
    });

    for (let r = 0; r < state.currentLayout.rows; r++) {
        for (let c = 0; c < state.currentLayout.cols; c++) {
            const cell = page.cells[`${r}-${c}`];
            if (!cell) continue;
            const { x, y } = getCellCoordinates(r, c, state.currentLayout);
            const pxX = mmToPx(x);
            const pxY = mmToPx(y);
            const pxCX = mmToPx(x + state.currentLayout.diameter / 2);
            const pxCY = mmToPx(y + state.currentLayout.diameter / 2);

            if (cell.bgColor) {
                ctx.beginPath();
                ctx.arc(pxCX, pxCY, bgRadiusPx, 0, 2 * Math.PI);
                ctx.fillStyle = cmykToRgbString(cell.bgColor);
                ctx.fill();
            }
            if (cell.imageId && imageMap.has(cell.imageId)) {
                await drawImage(imageMap.get(cell.imageId), pxX, pxY, mmToPx(state.currentLayout.diameter), mmToPx(state.currentLayout.diameter));
            }
        }
    }
    return canvas;
}

async function exportFiles(format) {
    if (!window.JSZip || !window.saveAs) { alert("导出组件未加载，请刷新页面。"); return; }
    const validPages = state.pages.filter(hasPageContent);
    if (validPages.length === 0) { alert("没有可导出的内容。"); return; }

    const zip = new JSZip();
    const promises = validPages.map(async (page, index) => {
        const fileName = `sticker_page_${index + 1}.${format}`;
        if (format === 'svg') {
            const content = generateSvgString(page);
            if (validPages.length === 1) {
                const blob = new Blob([content], { type: "image/svg+xml;charset=utf-8" });
                window.saveAs(blob, fileName);
                return null;
            }
            return { name: fileName, data: content };
        } else {
            const canvas = await drawPageToCanvas(page);
            return new Promise(resolve => {
                canvas.toBlob(blob => {
                    if (validPages.length === 1) {
                        window.saveAs(blob, fileName);
                        resolve(null);
                    } else {
                        resolve({ name: fileName, data: blob });
                    }
                }, `image/${format === 'jpg' ? 'jpeg' : 'png'}`);
            });
        }
    });

    const results = (await Promise.all(promises)).filter(r => r !== null);
    if (results.length > 0) {
        results.forEach(f => zip.file(f.name, f.data));
        const content = await zip.generateAsync({ type: "blob" });
        window.saveAs(content, `sticker_pages_${format}.zip`);
    }
}

async function runExport(format) {
    state.isExportMenuOpen = false;
    document.getElementById('export-menu').classList.add('hidden');
    state.isExporting = true;
    document.getElementById('export-btn').textContent = '导出中...';

    try {
        if (format === 'pdf') {
            exportToPdf();
        } else {
            await exportFiles(format);
        }
    } catch (e) {
        console.error(e);
        alert("导出失败");
    } finally {
        state.isExporting = false;
        document.getElementById('export-btn').innerHTML = '导出<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>';
    }
}

// === EXPORT MENU ===
function initExportMenu() {
    const exportBtn = document.getElementById('export-btn');
    const exportMenu = document.getElementById('export-menu');

    exportBtn.addEventListener('click', () => {
        state.isExportMenuOpen = !state.isExportMenuOpen;
        exportMenu.classList.toggle('hidden', !state.isExportMenuOpen);
    });

    exportMenu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => runExport(btn.dataset.format));
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.export-dropdown') && state.isExportMenuOpen) {
            state.isExportMenuOpen = false;
            exportMenu.classList.add('hidden');
        }
    });
}

// === HELP MODAL ===
function initHelpModal() {
    const helpBtn = document.getElementById('help-btn');
    const modal = document.getElementById('help-modal');
    const closeBtn = document.getElementById('close-modal');

    helpBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
}

// === CUSTOM LAYOUT PANEL ===
function initCustomLayoutPanel() {
    const ids = [
        'custom-page-width', 'custom-page-height',
        'custom-margin-top', 'custom-margin-bottom',
        'custom-margin-left', 'custom-margin-right',
        'custom-diameter',
        'custom-cols', 'custom-rows'
    ];

    const updateFromInputs = () => {
        const getVal = (id) => parseFloat(document.getElementById(id).value) || 0;
        state.customConfig = {
            pageWidth: getVal('custom-page-width'),
            pageHeight: getVal('custom-page-height'),
            marginTop: getVal('custom-margin-top'),
            marginBottom: getVal('custom-margin-bottom'),
            marginLeft: getVal('custom-margin-left'),
            marginRight: getVal('custom-margin-right'),
            diameter: Math.max(0.5, getVal('custom-diameter')),
            cols: Math.max(1, Math.round(getVal('custom-cols'))),
            rows: Math.max(1, Math.round(getVal('custom-rows')))
        };
        state.currentLayout = computeCustomLayout(state.customConfig);
        document.getElementById('custom-gap-h-display').textContent = state.currentLayout.gapH.toFixed(1);
        document.getElementById('custom-gap-v-display').textContent = state.currentLayout.gapV.toFixed(1);
        updateSheetSize();
        renderLayoutOptions();
        renderGrid();
        renderThumbnails();
    };

    ids.forEach(id => {
        document.getElementById(id).addEventListener('input', updateFromInputs);
    });
}

// === INITIALIZATION ===
function init() {
    // File upload
    document.getElementById('file-input').addEventListener('change', handleUpload);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab === 'image' ? ActiveTab.Image : btn.dataset.tab === 'background' ? ActiveTab.Background : ActiveTab.Page));
    });

    // Toolbar buttons
    document.getElementById('undo-btn').addEventListener('click', handleUndo);
    document.getElementById('redo-btn').addEventListener('click', handleRedo);
    document.getElementById('fill-one').addEventListener('click', fillNextEmpty);
    document.getElementById('fill-row').addEventListener('click', fillRowSmart);
    document.getElementById('fill-page').addEventListener('click', () => fillPage(state.currentPageIndex, false));
    document.getElementById('delete-one').addEventListener('click', deleteLastItem);
    document.getElementById('delete-row').addEventListener('click', deleteRowSmart);
    document.getElementById('delete-page').addEventListener('click', () => fillPage(state.currentPageIndex, true));

    // Page operations
    document.getElementById('add-page-btn').addEventListener('click', addPage);

    // Box select
    document.getElementById('box-fill').addEventListener('click', () => setBoxSelectMode(BoxSelectMode.Fill));
    document.getElementById('box-delete').addEventListener('click', () => setBoxSelectMode(BoxSelectMode.Delete));
    document.getElementById('box-off').addEventListener('click', () => setBoxSelectMode(BoxSelectMode.Off));

    // Initialize sub-components
    initCropperEvents();
    initColorPicker();
    initCanvasEvents();
    initScaleControls();
    initExportMenu();
    initHelpModal();
    initOffsetControl();
    initCustomLayoutPanel();

    // Initial render
    renderAll();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);