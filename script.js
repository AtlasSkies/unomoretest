let radar1, radar2;
let radar2Ready = false;
let chartColor = '#92dfec';
let isMulticolor = false;

// Constant for the center of the main chart (needed for the fixedCenter plugin)
const CHART1_CENTER = { x: 247, y: 250 }; 
const CHART_SIZE_MULTIPLIER = 1.0;

/* === Utility Functions === */
function hexToRGBA(hex, alpha) {
    if (hex.startsWith('rgb')) return hex.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function getAxisColors() {
    return [
        axisColors.powerColor.value,
        axisColors.speedColor.value,
        axisColors.trickColor.value,
        axisColors.recoveryColor.value,
        axisColors.defenseColor.value
    ].map(color => color || chartColor); // Use chartColor as fallback
}

/* === Gradient Generator (for multicolor) === */
function createAxisGradient(ctx, chartArea, colors) {
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;

    const grad = ctx.createConicGradient(-Math.PI / 2, cx, cy);
    const n = colors.length;
    
    // Add colors to the conic gradient with slight overlap to ensure solid segments
    colors.forEach((c, i) => {
        grad.addColorStop(i / n, c);
        grad.addColorStop((i + 1) / n - 0.0001, c);
    });
    return grad;
}


/* === Chart.js Plugins (Copied from your working code) === */
const fixedCenterPlugin = { /* ... your fixedCenterPlugin implementation ... */ 
    id: 'fixedCenter',
    beforeLayout(chart) {
        const opt = chart.config.options.fixedCenter;
        if (!opt?.enabled) return;
        const r = chart.scales.r;
        if (opt.centerX && opt.centerY) {
            r.xCenter = opt.centerX;
            r.yCenter = opt.centerY;
        }
    }
};

const radarBackgroundPlugin = { /* ... your radarBackgroundPlugin implementation ... */
    id: 'customPentagonBackground',
    beforeDatasetsDraw(chart) {
        const opts = chart.config.options.customBackground;
        if (!opts?.enabled) return;
        const r = chart.scales.r, ctx = chart.ctx;
        const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
        const N = chart.data.labels.length, start = -Math.PI / 2;

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, '#f8fcff');
        gradient.addColorStop(0.33, chartColor); // Use the ability color here
        gradient.addColorStop(1, chartColor);

        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
            const a = start + (i * 2 * Math.PI / N);
            const x = cx + radius * Math.cos(a);
            const y = cy + radius * Math.sin(a);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
    },
    afterDatasetsDraw(chart) {
        const opts = chart.config.options.customBackground;
        if (!opts?.enabled) return;
        const r = chart.scales.r, ctx = chart.ctx;
        const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
        const N = chart.data.labels.length, start = -Math.PI / 2;

        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
            const a = start + (i * 2 * Math.PI / N);
            const x = cx + radius * Math.cos(a);
            const y = cy + radius * Math.sin(a);
            ctx.moveTo(cx, cy);
            ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#35727d';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        for (let i = 0; i < N; i++) {
            const a = start + (i * 2 * Math.PI / N);
            const x = cx + radius * Math.cos(a);
            const y = cy + radius * Math.sin(a);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = '#184046';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }
};

const outlinedLabelsPlugin = { /* ... your outlinedLabelsPlugin implementation ... */
    id: 'outlinedLabels',
    afterDraw(chart) {
        const ctx = chart.ctx;
        const r = chart.scales.r;
        const labels = chart.data.labels;
        const cx = r.xCenter, cy = r.yCenter;
        const isOverlayChart = chart.canvas.id === 'radarChart2';
        const baseRadius = r.drawingArea * 1.1;
        const extendedRadius = r.drawingArea * 1.15;
        const base = -Math.PI / 2;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'italic 18px Candara';
        // Use the current chartColor for the outline
        ctx.strokeStyle = chartColor; 
        ctx.fillStyle = 'white';
        ctx.lineWidth = 4;

        labels.forEach((label, i) => {
            let angle = base + (i * 2 * Math.PI / labels.length);
            let radiusToUse = baseRadius;
            if (isOverlayChart && (i === 1 || i === 4)) radiusToUse = extendedRadius;
            const x = cx + radiusToUse * Math.cos(angle);
            let y = cy + radiusToUse * Math.sin(angle);

            if (i === 0) y -= 5;
            if (isOverlayChart && (i === 1 || i === 4)) y -= 42; 

            ctx.strokeText(label, x, y);
            ctx.fillText(label, x, y);
        });
        ctx.restore();
    }
};

const inputValuePlugin = { /* ... your inputValuePlugin implementation ... */
    id: 'inputValuePlugin',
    afterDraw(chart) {
        // Only draw this plugin if customBackground is DISABLED (i.e., on radarChart1)
        if (chart.config.options.customBackground.enabled) return; 
        
        const ctx = chart.ctx;
        const r = chart.scales.r;
        const data = chart.data.datasets[0].data;
        const labels = chart.data.labels;
        const cx = r.xCenter, cy = r.yCenter;
        const baseRadius = r.drawingArea * 1.1;
        const base = -Math.PI / 2;
        const offset = 20;
        
        ctx.save();
        ctx.font = '15px Candara';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        labels.forEach((label, i) => {
            const angle = base + (i * 2 * Math.PI / labels.length);
            let radiusToUse = baseRadius;
            
            // Adjustments for the overlay chart labels are not needed here since this only runs on radarChart1
            
            const x = cx + (radiusToUse + offset) * Math.cos(angle);
            let y = cy + (radiusToUse + offset) * Math.sin(angle);

            if (i === 0) y -= 20;
            // Adjust position for bottom labels on the main chart (radarChart1)
            if (i === 1) y += 20; 
            if (i === 4) y += 20;

            ctx.fillText(`(${data[i] || 0})`, x, y);
        });
        ctx.restore();
    }
};

/* === CHART CREATOR === */
function makeRadar(ctx, showPoints = true, withBackground = false, fixedCenter = null) {
    return new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                // Use a function for background to handle both single and multi-color modes
                backgroundColor: context => {
                    const { chart } = context;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return null;

                    if (isMulticolor) {
                        const axisColors = getAxisColors();
                        return createAxisGradient(ctx, chartArea, axisColors);
                    } else {
                        return hexToRGBA(chartColor, 0.65);
                    }
                },
                // Border and Point colors are set in updateCharts()
                borderColor: chartColor,
                pointBorderColor: chartColor, 
                pointRadius: showPoints ? 5 : 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            layout: { padding: { top: 25, bottom: 25, left: 10, right: 10 } },
            scales: {
                r: {
                    grid: { display: withBackground ? false : '#ddd' }, // Show grid on main chart, hide on overlay
                    angleLines: { color: withBackground ? '#6db5c0' : '#ccc', lineWidth: 1 },
                    suggestedMin: 0,
                    suggestedMax: 10,
                    ticks: { display: false },
                    pointLabels: { color: 'transparent' } // Labels handled by plugin
                }
            },
            customBackground: { enabled: withBackground },
            fixedCenter: { enabled: !!fixedCenter, centerX: fixedCenter?.x, centerY: fixedCenter?.y },
            plugins: { legend: { display: false } }
        },
        plugins: [fixedCenterPlugin, radarBackgroundPlugin, outlinedLabelsPlugin, inputValuePlugin]
    });
}


/* === DOM ELEMENTS === */
const viewBtn = document.getElementById('viewBtn');
const imgInput = document.getElementById('imgInput');
const uploadedImg = document.getElementById('uploadedImg');
const overlay = document.getElementById('overlay');
const overlayImg = document.getElementById('overlayImg');
const overlayName = document.getElementById('overlayName');
const overlayAbility = document.getElementById('overlayAbility');
const overlayLevel = document.getElementById('overlayLevel');
const closeBtn = document.getElementById('closeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const powerInput = document.getElementById('powerInput');
const speedInput = document.getElementById('speedInput');
const trickInput = document.getElementById('trickInput');
const recoveryInput = document.getElementById('recoveryInput');
const defenseInput = document.getElementById('defenseInput');
const colorPicker = document.getElementById('colorPicker');
const nameInput = document.getElementById('nameInput');
const abilityInput = document.getElementById('abilityInput');
const levelInput = document.getElementById('levelInput');
const multiBtn = document.getElementById('multiBtn');

const axisColors = {
    powerColor: document.getElementById('powerColor'),
    speedColor: document.getElementById('speedColor'),
    trickColor: document.getElementById('trickColor'),
    recoveryColor: document.getElementById('recoveryColor'),
    defenseColor: document.getElementById('defenseColor')
};


/* === MAIN CHART INIT === */
window.addEventListener('load', () => {
    // Set initial chart color from HTML value
    chartColor = colorPicker.value || chartColor; 
    
    const ctx1 = document.getElementById('radarChart1').getContext('2d');
    radar1 = makeRadar(ctx1, true, false, CHART1_CENTER);
    updateCharts();
});

/* === UPDATE CHARTS (Handles all data and color updates) === */
function updateCharts() {
    const vals = [
        +powerInput.value || 0,
        +speedInput.value || 0,
        +trickInput.value || 0,
        +recoveryInput.value || 0,
        +defenseInput.value || 0
    ];
    
    // Update main color
    chartColor = colorPicker.value || chartColor; 

    // Update Max scale for radar1 based on inputs, but keep radar2 max at 10
    const maxVal = Math.max(...vals, 10); 
    
    // For the overlay chart (radar2), values are capped at 10
    const cappedVals = vals.map(v => Math.min(v, 10)); 

    if (radar1) {
        radar1.options.scales.r.suggestedMax = maxVal;
        radar1.data.datasets[0].data = vals;
        radar1.data.datasets[0].borderColor = chartColor;
        radar1.data.datasets[0].pointBorderColor = chartColor;
        // The background color is a function, which re-evaluates on update()
        radar1.update();
    }

    if (radar2Ready && radar2) {
        radar2.data.datasets[0].data = cappedVals;
        radar2.data.datasets[0].borderColor = chartColor;
        radar2.data.datasets[0].pointBorderColor = chartColor;
        // The background color is a function, which re-evaluates on update()
        radar2.update();
    }
}


/* === MULTICOLOR TOGGLE === */
multiBtn.addEventListener('click', () => {
    isMulticolor = !isMulticolor;
    multiBtn.textContent = isMulticolor ? 'Single Color' : 'Multicolor';

    // Toggle visibility of axis color pickers
    Object.values(axisColors).forEach(el => {
        el.classList.toggle('hidden', !isMulticolor); 
    });

    updateCharts(); // Force redraw to apply the new gradient/color
});


/* === EVENT LISTENERS === */
// Inputs for stats, main color, and axis colors
const allInputs = [
    powerInput, speedInput, trickInput, recoveryInput, defenseInput, colorPicker, 
    ...Object.values(axisColors) 
];

allInputs.forEach(el => {
    el.addEventListener('input', updateCharts);
    el.addEventListener('change', updateCharts);
});

// Image Upload
imgInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { uploadedImg.src = ev.target.result; };
    reader.readAsDataURL(file);
});

// Overlay Display (View Button)
viewBtn.addEventListener('click', () => {
    overlay.classList.remove('hidden');
    overlayImg.src = uploadedImg.src;
    overlayName.textContent = nameInput.value || '-';
    overlayAbility.textContent = abilityInput.value || '-';
    overlayLevel.textContent = levelInput.value || '-';

    setTimeout(() => {
        const img = document.getElementById('overlayImg');
        const textBox = document.querySelector('.text-box');
        const overlayChart = document.querySelector('.overlay-chart');
        
        // Calculate dynamic chart size (logic carried over from working code)
        const imgHeight = img.offsetHeight;
        const textHeight = textBox.offsetHeight;
        const targetSize = (imgHeight + textHeight) * CHART_SIZE_MULTIPLIER;

        overlayChart.style.height = `${targetSize}px`;
        overlayChart.style.width = `${targetSize}px`;

        // Watermark logic (carried over from working code)
        const existingWatermark = document.querySelector('.image-section .watermark-image');
        if (!existingWatermark) {
            const wm = document.createElement('div');
            wm.textContent = 'AS';
            wm.className = 'watermark-image';
            Object.assign(wm.style, {
                position: 'absolute', bottom: '8px', left: '10px',
                fontFamily: 'Candara', fontWeight: 'bold', fontSize: '6px',
                color: 'rgba(0,0,0,0.15)', pointerEvents: 'none', zIndex: '2'
            });
            document.querySelector('.image-section').appendChild(wm);
        }

        const ctx2 = document.getElementById('radarChart2').getContext('2d');
        if (!radar2Ready) {
            // Create radar2 chart with background and no points
            radar2 = makeRadar(ctx2, false, true, { x: targetSize / 2, y: targetSize / 2 });
            radar2.options.scales.r.suggestedMax = 10; // Max is always 10 for the overlay chart
            radar2Ready = true;
        } else {
            radar2.resize();
        }
        updateCharts();
    }, 200);
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

// Download Button (HTML2Canvas)
downloadBtn.addEventListener('click', () => {
    downloadBtn.style.visibility = 'hidden';
    closeBtn.style.visibility = 'hidden';

    const box = document.getElementById('characterBox');
    // Save original styles for restoration
    const originalFlex = box.style.flexDirection;
    const originalWidth = box.style.width;
    const originalHeight = box.style.height;

    // Apply horizontal layout for consistent download image
    box.style.flexDirection = 'row';
    box.style.width = 'fit-content'; 
    box.style.height = 'fit-content';
    box.style.maxHeight = 'none';
    box.style.overflow = 'visible';

    html2canvas(box, { scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        const cleanName = (nameInput.value || 'Unnamed').replace(/\s+/g, '_');
        link.download = `${cleanName}_CharacterChart.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        // Restore original styles for modal display
        box.style.flexDirection = originalFlex;
        box.style.width = originalWidth;
        box.style.height = originalHeight;

        downloadBtn.style.visibility = 'visible';
        closeBtn.style.visibility = 'visible';
    });
});
