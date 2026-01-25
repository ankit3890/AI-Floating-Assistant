const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class StartupManager {
    constructor() {
        this.configPath = path.join(app.getPath('userData'), 'startup-config.json');
        this.data = this._loadData();
    }

    _loadData() {
        try {
            if (fs.existsSync(this.configPath)) {
                return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            }
        } catch (error) {
            console.error('StartupManager: Failed to load config', error);
        }
        return {};
    }

    _saveData() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('StartupManager: Failed to save config', error);
        }
    }

    /**
     * Checks if this is the first time the app is run with this manager.
     */
    isFirstRun() {
        // Changed key to force re-run of initialization logic since previous run 
        // might have failed due to dev-mode restrictions.
        // v5: Force re-run to enable startup with new custom name parameter.
        return !this.data.has_run_v5;
    }

    /**
     * initializes the startup configuration.
     * If first run, enables startup by default.
     */
    initialize() {
        // First, always clean up the old "Electron" entry if it exists
        this._removeLegacyEntry();

        if (this.isFirstRun()) {
            console.log('StartupManager: First run detected (v5). Enabling auto-startup.');
            this.enable(); // Enable by default
            this.data.has_run_v5 = true;
            this._saveData();
        } else {
            // Check if enabled, and if so, RE-APPLY to verify args (and ensure it's the correct one)
            if (this.isEnabled()) {
                console.log('StartupManager: Startup enabled. Refreshing registration.');
                this.enable();
            } else {
                console.log('StartupManager: Startup is currently disabled.');
            }
        }
    }

    /**
     * Helper to remove the incorrect "no-path" entry created by earlier dev versions
     */
    _removeLegacyEntry() {
        try {
            // Remove old entry without custom name (would appear as "Electron")
            app.setLoginItemSettings({
                openAtLogin: false,
                args: ['--startup'],
                path: process.execPath
            });
            console.log('StartupManager: Legacy entry cleanup attempted.');
        } catch (e) {
            console.error('StartupManager: Legacy cleanup failed', e);
        }
    }

    /**
     * Enable auto-startup
     */
    enable() {
        console.log('StartupManager: Enabling auto-startup (Executable:', process.execPath, ')');
        
        const args = ['--startup'];
        if (!app.isPackaged) {
            args.unshift(app.getAppPath());
        }

        app.setLoginItemSettings({
            openAtLogin: true,
            args: args,
            path: process.execPath,
            name: 'AI Floating Assistant' // Custom name to avoid "Electron" in startup
        });
        console.log('StartupManager: Auto-startup ENABLED');
    }

    /**
     * Disable auto-startup
     */
    disable() {
        // 1. Remove the correct current entry with custom name
        const args = ['--startup'];
        if (!app.isPackaged) {
            args.unshift(app.getAppPath());
        }

        app.setLoginItemSettings({
            openAtLogin: false,
            args: args, 
            path: process.execPath,
            name: 'AI Floating Assistant'
        });

        // 2. Also ensure legacy entry is gone
        this._removeLegacyEntry();

        console.log('StartupManager: Auto-startup DISABLED');
    }

    /**
     * Check if auto-startup is enabled
     * @returns {boolean}
     */
    isEnabled() {
        const args = ['--startup'];
        if (!app.isPackaged) {
            args.unshift(app.getAppPath());
        }

        const settings = app.getLoginItemSettings({
            args: args,
            name: 'AI Floating Assistant'
        });
        return settings.openAtLogin;
    }

    /**
     * Toggle startup state
     * @returns {boolean} New state
     */
    toggle() {
        if (this.isEnabled()) {
            this.disable();
            return false;
        } else {
            this.enable();
            return true;
        }
    }
}

module.exports = new StartupManager();
