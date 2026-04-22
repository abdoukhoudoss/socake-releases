/**
 * SoCake — Electron main process
 * Lance le serveur Express en arrière-plan, ouvre la fenêtre principale.
 */

const { app, BrowserWindow, shell, Menu, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const http = require('http');
const { autoUpdater } = require('electron-updater');

// ── Chemins userData ──────────────────────────────────────────────────────────
const userDataPath = app.getPath('userData');
process.env.SOCAKE_USER_DATA = userDataPath;
process.env.SOCAKE_UPLOADS   = path.join(userDataPath, 'uploads');

// ── Instance unique ───────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

let mainWindow  = null;
let tray        = null;
let SERVER_PORT = 3000;

// ── Page de chargement affichée immédiatement ─────────────────────────────────
const LOADING_HTML = `data:text/html,<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background: #FFF8F5;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100vh; font-family: sans-serif;
    color: #7B3F5E;
  }
  .logo { font-size: 2.4rem; font-weight: 700; letter-spacing: -1px; margin-bottom: 12px; }
  .sub  { font-size: .95rem; color: #aaa; margin-bottom: 36px; }
  .spinner {
    width: 40px; height: 40px;
    border: 4px solid #f3c6d0;
    border-top-color: #E8748E;
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
  <div class="logo">🎂 SoCake</div>
  <div class="sub">Démarrage en cours…</div>
  <div class="spinner"></div>
</body>
</html>`;

// ── Créer la fenêtre (avec page de chargement) ────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 900, minHeight: 600,
    title: 'SoCake',
    icon: path.join(__dirname, 'public', 'icon.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    backgroundColor: '#FFF8F5',
    show: true,   // Affichage immédiat (page de chargement)
  });

  // Page de chargement visible tout de suite
  mainWindow.loadURL(LOADING_HTML);
  Menu.setApplicationMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${SERVER_PORT}`)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Démarrer le serveur Express ───────────────────────────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    const probe = http.createServer();
    probe.listen(SERVER_PORT, '127.0.0.1', () => {
      probe.close(() => {
        try {
          require('./server.js');
          waitForServer(resolve, reject);
        } catch (err) { reject(err); }
      });
    });
    probe.on('error', () => {
      probe.close();
      SERVER_PORT++;
      if (SERVER_PORT > 3020) return reject(new Error('Aucun port disponible (3000-3020)'));
      startServer().then(resolve).catch(reject);
    });
  });
}

// ── Attendre que Express réponde (polling rapide 100 ms) ──────────────────────
function waitForServer(resolve, reject, attempts = 0) {
  http.get(`http://127.0.0.1:${SERVER_PORT}/api/company`, () => {
    resolve();
  }).on('error', () => {
    if (attempts >= 80) return reject(new Error('Le serveur n\'a pas démarré (timeout 8 s)'));
    setTimeout(() => waitForServer(resolve, reject, attempts + 1), 100);
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'public', 'icon.png');
  let img;
  try { img = nativeImage.createFromPath(iconPath); } catch { img = nativeImage.createEmpty(); }

  tray = new Tray(img);
  tray.setToolTip('SoCake');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir SoCake', click: showOrCreate },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() },
  ]));
  tray.on('double-click', showOrCreate);
}

function showOrCreate() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
    // Navigue directement (serveur déjà démarré)
    mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}`);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // 1. Fenêtre visible immédiatement (spinner de chargement)
  createWindow();
  createTray();

  // 2. Serveur en parallèle
  startServer()
    .then(() => {
      // 3. Navigue vers l'app une fois prête
      if (mainWindow) mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}`);
      // 4. Vérifie les mises à jour après démarrage (5 s de délai)
      setTimeout(setupAutoUpdater, 5000);
    })
    .catch(err => {
      dialog.showErrorBox('SoCake — Erreur de démarrage', String(err.message || err));
      app.quit();
    });
});

// Si l'utilisateur double-clique sur l'icône alors qu'une instance tourne déjà
app.on('second-instance', showOrCreate);

// Fermer la fenêtre → reste dans le tray (ne quitte pas l'appli)
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') app.quit();
  // Windows/Linux : on reste dans le tray
});

app.on('activate', () => { if (!mainWindow) showOrCreate(); });

// ── Auto-update ───────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  // Vérifie silencieusement au démarrage
  autoUpdater.checkForUpdatesAndNotify().catch(() => {
    // Pas de connexion internet ou repo introuvable → on ignore silencieusement
  });

  // Une mise à jour est disponible → demande confirmation
  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow || BrowserWindow.getFocusedWindow(), {
      type: 'info',
      title: 'Mise à jour disponible',
      message: `SoCake ${info.version} est disponible.`,
      detail: 'Le téléchargement va démarrer en arrière-plan. Vous serez notifié quand il sera prêt.',
      buttons: ['OK'],
      icon: path.join(__dirname, 'public', 'icon.png'),
    });
  });

  // Téléchargement terminé → propose d'installer
  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow || BrowserWindow.getFocusedWindow(), {
      type: 'info',
      title: 'Mise à jour prête',
      message: `SoCake ${info.version} est téléchargé.`,
      detail: 'Cliquez sur "Installer" pour appliquer la mise à jour. L\'application redémarrera automatiquement.',
      buttons: ['Installer maintenant', 'Plus tard'],
      defaultId: 0,
      icon: path.join(__dirname, 'public', 'icon.png'),
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  // Pas de mise à jour → rien (silencieux)
  autoUpdater.on('update-not-available', () => {});
  autoUpdater.on('error', () => {}); // Silencieux si pas d'internet
}
