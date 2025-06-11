// Add this to your plugin's web configuration files
// This should go in your plugin's web interface directory

// randomSampleConfig.js
class RandomSampleConfig {
    constructor() {
        this.selectedLibraries = new Set();
        this.availableLibraries = [];
        this.sampleSize = 20;
        this.includeMovies = true;
        this.includeTvShows = true;
        this.includeMusic = false;
    }

    async init() {
        await this.loadAvailableLibraries();
        await this.loadConfiguration();
        this.renderInterface();
        this.bindEvents();
    }

    async loadAvailableLibraries() {
        try {
            const response = await fetch('/RandomSample/Libraries', {
                headers: {
                    'Authorization': `MediaBrowser Token="${ApiClient.accessToken()}"`
                }
            });
            
            if (response.ok) {
                this.availableLibraries = await response.json();
            } else {
                console.error('Failed to load libraries');
            }
        } catch (error) {
            console.error('Error loading libraries:', error);
        }
    }

    async loadConfiguration() {
        // Load saved configuration from plugin settings
        try {
            const config = await ApiClient.getPluginConfiguration('HomeSections');
            if (config.randomSampleConfig) {
                this.selectedLibraries = new Set(config.randomSampleConfig.selectedLibraries || []);
                this.sampleSize = config.randomSampleConfig.sampleSize || 20;
                this.includeMovies = config.randomSampleConfig.includeMovies !== false;
                this.includeTvShows = config.randomSampleConfig.includeTvShows !== false;
                this.includeMusic = config.randomSampleConfig.includeMusic || false;
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
        }
    }

    async saveConfiguration() {
        try {
            const config = await ApiClient.getPluginConfiguration('HomeSections');
            config.randomSampleConfig = {
                selectedLibraries: Array.from(this.selectedLibraries),
                sampleSize: this.sampleSize,
                includeMovies: this.includeMovies,
                includeTvShows: this.includeTvShows,
                includeMusic: this.includeMusic
            };
            
            await ApiClient.updatePluginConfiguration('HomeSections', config);
            
            // Also register/update the section
            await this.registerSection();
            
            // Show success message
            this.showMessage('Configuration saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving configuration:', error);
            this.showMessage('Error saving configuration', 'error');
        }
    }

    async registerSection() {
        try {
            const sectionData = {
                id: 'random-library-sample',
                displayText: 'Random Library Sample',
                limit: 1,
                additionalData: JSON.stringify({
                    libraryIds: Array.from(this.selectedLibraries),
                    sampleSize: this.sampleSize,
                    includeMovies: this.includeMovies,
                    includeTvShows: this.includeTvShows,
                    includeMusic: this.includeMusic
                }),
                resultsEndpoint: '/RandomSample/GetRandomSample'
            };

            await fetch('/HomeScreen/RegisterSection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `MediaBrowser Token="${ApiClient.accessToken()}"`
                },
                body: JSON.stringify(sectionData)
            });
        } catch (error) {
            console.error('Error registering section:', error);
        }
    }

    renderInterface() {
        const container = document.getElementById('randomSampleConfigContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="random-sample-config">
                <h2>Random Library Sample Configuration</h2>
                
                <div class="config-section">
                    <h3>Sample Size</h3>
                    <input type="number" id="sampleSize" min="1" max="50" value="${this.sampleSize}">
                    <small>Number of random items to show (1-50)</small>
                </div>

                <div class="config-section">
                    <h3>Content Types</h3>
                    <label>
                        <input type="checkbox" id="includeMovies" ${this.includeMovies ? 'checked' : ''}>
                        Include Movies
                    </label>
                    <label>
                        <input type="checkbox" id="includeTvShows" ${this.includeTvShows ? 'checked' : ''}>
                        Include TV Shows
                    </label>
                    <label>
                        <input type="checkbox" id="includeMusic" ${this.includeMusic ? 'checked' : ''}>
                        Include Music
                    </label>
                </div>

                <div class="config-section">
                    <h3>Select Libraries</h3>
                    <div class="library-selection">
                        ${this.availableLibraries.map(library => `
                            <label class="library-item">
                                <input type="checkbox" 
                                       value="${library.Id}" 
                                       ${this.selectedLibraries.has(library.Id) ? 'checked' : ''}>
                                <span class="library-name">${library.Name}</span>
                                <span class="library-type">(${library.CollectionType || 'Mixed'})</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="config-actions">
                    <button id="saveConfig" class="btn-primary">Save Configuration</button>
                    <button id="testSection" class="btn-secondary">Test Section</button>
                </div>

                <div id="messageContainer"></div>
            </div>
        `;
    }

    bindEvents() {
        // Sample size change
        document.getElementById('sampleSize')?.addEventListener('change', (e) => {
            this.sampleSize = parseInt(e.target.value) || 20;
        });

        // Content type checkboxes
        document.getElementById('includeMovies')?.addEventListener('change', (e) => {
            this.includeMovies = e.target.checked;
        });

        document.getElementById('includeTvShows')?.addEventListener('change', (e) => {
            this.includeTvShows = e.target.checked;
        });

        document.getElementById('includeMusic')?.addEventListener('change', (e) => {
            this.includeMusic = e.target.checked;
        });

        // Library selection
        document.querySelectorAll('.library-selection input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedLibraries.add(e.target.value);
                } else {
                    this.selectedLibraries.delete(e.target.value);
                }
            });
        });

        // Save button
        document.getElementById('saveConfig')?.addEventListener('click', () => {
            this.saveConfiguration();
        });

        // Test button
        document.getElementById('testSection')?.addEventListener('click', () => {
            this.testSection();
        });
    }

    async testSection() {
        try {
            const response = await fetch('/RandomSample/GetRandomSample', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `MediaBrowser Token="${ApiClient.accessToken()}"`
                },
                body: JSON.stringify({
                    LibraryIds: Array.from(this.selectedLibraries),
                    SampleSize: this.sampleSize,
                    IncludeMovies: this.includeMovies,
                    IncludeTvShows: this.includeTvShows,
                    IncludeMusic: this.includeMusic
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.showMessage(`Test successful! Found ${result.TotalRecordCount} random items.`, 'success');
            } else {
                this.showMessage('Test failed. Check your configuration.', 'error');
            }
        } catch (error) {
            console.error('Test error:', error);
            this.showMessage('Test error occurred.', 'error');
        }
    }

    showMessage(text, type) {
        const container = document.getElementById('messageContainer');
        if (!container) return;

        container.innerHTML = `<div class="message ${type}">${text}</div>`;
        setTimeout(() => {
            container.innerHTML = '';
        }, 5000);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    const config = new RandomSampleConfig();
    config.init();
});

// CSS styles - add to your plugin's CSS file
const styles = `
.random-sample-config {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
}

.config-section {
    margin-bottom: 30px;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
}

.config-section h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #333;
}

.library-selection {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.library-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border: 1px solid #eee;
    border-radius: 4px;
    cursor: pointer;
}

.library-item:hover {
    background-color: #f5f5f5;
}

.library-name {
    font-weight: bold;
}

.library-type {
    color: #666;
    font-size: 0.9em;
}

.config-actions {
    display: flex;
    gap: 10px;
    margin-top: 30px;
}

.btn-primary, .btn-secondary {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
}

.btn-primary {
    background-color: #007bff;
    color: white;
}

.btn-secondary {
    background-color: #6c757d;
    color: white;
}

.message {
    padding: 10px;
    margin-top: 10px;
    border-radius: 4px;
}

.message.success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}

.message.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
}

#sampleSize {
    width: 80px;
    padding: 5px;
    margin-right: 10px;
}

label {
    display: block;
    margin-bottom: 10px;
}

label input[type="checkbox"] {
    margin-right: 8px;
}
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
`