/* === DOWNLOAD CHARACTER CHART === */
downloadBtn.addEventListener('click', () => {
  downloadBtn.style.visibility = 'hidden';
  closeBtn.style.visibility = 'hidden';

  const characterBox = document.getElementById('characterBox');
  const originalScroll = characterBox.scrollTop;
  const originalOverflow = characterBox.style.overflow;

  // Expand to full height for capture
  characterBox.style.overflow = 'visible';
  characterBox.scrollTop = 0;

  // Use full scrollHeight to ensure entire element is rendered
  html2canvas(characterBox, {
    scale: 2,
    windowWidth: characterBox.scrollWidth,
    windowHeight: characterBox.scrollHeight,
    scrollX: 0,
    scrollY: -window.scrollY,
  }).then(canvas => {
    const link = document.createElement('a');
    const cleanName = (nameInput.value || 'Unnamed').replace(/\s+/g, '_');
    link.download = `${cleanName}_CharacterChart.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    // Restore UI state
    characterBox.style.overflow = originalOverflow;
    characterBox.scrollTop = originalScroll;
    downloadBtn.style.visibility = 'visible';
    closeBtn.style.visibility = 'visible';
  });
});
