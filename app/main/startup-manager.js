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
        // v4: Force re-run again because v3 might have failed due to syntax error.
        return !this.data.has_run_v4;
    }

    /**
     * initializes the startup configuration.
     * If first run, enables startup by default.
     */
    initialize() {
        // REMOVED aggressive cleanup: It seems to conflict with the valid entry 
        // because both target the same electron.exe in dev mode.
        // Since we already ran it in v3 transition, we can stop calling it on every boot.

        if (this.isFirstRun()) {
            console.log('StartupManager: First run detected (v4). Enabling auto-startup.');
            this.enable(); // Enable by default
            this.data.has_run_v4 = true;
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
            app.setLoginItemSettings({
                openAtLogin: false,
                args: ['--startup'], // The "bad" args that didn't have app path
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
            path: process.execPath
        });
        console.log('StartupManager: Auto-startup ENABLED');
    }

    /**
     * Disable auto-startup
     */
    disable() {
        // 1. Remove the correct current entry
        const args = ['--startup'];
        if (!app.isPackaged) {
            args.unshift(app.getAppPath());
        }

        app.setLoginItemSettings({
            openAtLogin: false,
            args: args, 
            path: process.execPath
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
            args: args
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
