const fs = require('fs');
let lines = fs.readFileSync('css/style.css', 'utf8').split('\n');

const mediaQueryStartIndex = lines.findIndex(l => l.startsWith('@media (max-aspect-ratio: 4/3)'));

if (mediaQueryStartIndex !== -1) {
  lines = lines.slice(0, mediaQueryStartIndex);
}

const newMediaQueries = `
.btn-action .iconify {
  font-size: 2.6vh;
}
.factor-name .iconify {
  font-size: 3.2vh;
  width: 3.2vh;
  height: 3.2vh;
}

/* Responsividade: Tablet e Mobile Landscape */
@media (max-width: 1024px), (max-aspect-ratio: 4/3) {
  html, body {
    height: auto !important;
    max-height: none !important;
    overflow-y: auto !important;
  }
  #app-main {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    min-height: 100vh;
  }
  .dashboard-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    gap: 2vh;
  }
  .panel-status, .panel-factors {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  .action-board {
    overflow: visible !important;
  }
  .huge-instructions {
    overflow: visible !important;
  }
  
  .factors-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: auto;
    height: auto !important;
    max-height: none !important;
    gap: 1.5vh;
  }
  .factor {
    min-height: 22vh;
    padding: 2vh 2vw;
  }
  .factor-value {
    font-size: 6vh;
    margin: 2vh 0;
  }
  .factor-name {
    font-size: 2.2vh;
    flex-direction: row;
    gap: 0.8vw;
  }
  .score-number-display {
    font-size: 8vh;
  }
  .huge-instructions li {
    font-size: 1.8vh;
    padding: 1.5vh;
  }
  .btn-action {
    font-size: 1.8vh;
    padding: 1.5vh;
  }
  .btn-action .iconify {
    font-size: 2.8vh;
  }
  .logo {
    font-size: 2.5vh;
  }
}

/* Mobile Portrait - Telas Pequenas */
@media (max-width: 600px) {
  .factors-grid {
    grid-template-columns: 1fr;
  }
  .personas {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .btn-action {
    flex: 1 1 calc(33% - 1vw);
    font-size: 1.6vh;
    padding: 1.2vh;
  }
}
`;

lines.push(newMediaQueries);
fs.writeFileSync('css/style.css', lines.join('\n'));
