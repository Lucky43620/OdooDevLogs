// Configuration dynamique chargée depuis l'API
window.API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : `http://${window.location.hostname}:8000`;

// Charger la configuration depuis le serveur
async function loadConfig() {
    try {
        // Essayer d'abord avec l'URL détectée
        const response = await fetch(`${window.API_BASE_URL}/config`);
        const config = await response.json();

        // Mettre à jour l'URL de l'API avec celle du serveur
        window.API_BASE_URL = config.api_url;

        console.log('✅ Configuration chargée:', config);
        return config;
    } catch (error) {
        console.warn('⚠️ Impossible de charger la config, utilisation des valeurs par défaut', error);
        return {
            api_url: window.API_BASE_URL,
            version: '1.0.0',
            features: {
                analytics: true,
                export: true,
                regex_search: true
            }
        };
    }
}

// Exporter pour utilisation dans app.js
window.loadConfig = loadConfig;
window.getApiUrl = () => window.API_BASE_URL;
