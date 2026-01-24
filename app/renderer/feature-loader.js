class FeatureLoader {
    constructor() {
        this.loaded = new Set();
    }

    async loadFeature(name, htmlPath) {
        if (this.loaded.has(name)) return;

        try {
            console.log(`Loading feature: ${name} from ${htmlPath}`);
            const response = await fetch(htmlPath);
            if (!response.ok) throw new Error(`Failed to load ${htmlPath}`);
            const html = await response.text();

            // Inject into app-container (main wrapper)
            const appContainer = document.querySelector('.app-container') || document.body;
            appContainer.insertAdjacentHTML('beforeend', html);
            
            this.loaded.add(name);
            console.log(`Feature ${name} loaded.`);
        } catch (err) {
            console.error(`Error loading feature ${name}:`, err);
        }
    }
    
    async loadAll() {
        await Promise.all([


            // Screen Drawing is a separate window, no HTML injection needed here (main process handles it)
        ]);
        
        // Dispatch event so renderer knows DOM is ready
        window.dispatchEvent(new Event('features-loaded'));
    }
}

window.featureLoader = new FeatureLoader();
console.log('Feature Loader Initialized');
