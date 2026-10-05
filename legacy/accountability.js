
class AccountabilityPartner {
    constructor() {
        this.videoElement = null;
        this.model = null;
        this.isSessionActive = false;
        this.detectionInterval = null;
        this.lastPersonDetectedTime = Date.now();
        this.isPersonGone = false;
        this.goneThreshold = 1000; // 1 second - since we check every 15s, if person is gone at check time, pause quickly
        this.checkIntervalMs = 15000; // Check every 15 seconds to save resources

        // Callbacks
        this.onPersonGone = null;
        this.onPersonBack = null;
    }

    async init() {
        if (!this.videoElement) {
            this.videoElement = document.getElementById('video');
        }

        if (!this.model) {
            console.log('Accountability: Loading COCO-SSD model...');
            try {
                this.model = await cocoSsd.load();
                console.log('Accountability: COCO-SSD model loaded successfully.');
            } catch (error) {
                console.error('Accountability: Failed to load COCO-SSD model:', error);
            }
        }
    }

    async requestPermissions() {
        console.log('Accountability: Requesting camera permissions...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240 }
            });
            console.log('Accountability: Camera permission granted.');
            // Stop the stream immediately, we just wanted to ask for permission
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('Accountability: Error requesting permissions:', error);
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                alert('Camera permission denied. Please enable camera access in your browser settings for this site.');
            }
            return false;
        }
    }

    async startSession(onGone, onBack) {
        console.log('Accountability: startSession called. Active:', this.isSessionActive);
        if (this.isSessionActive) return;

        this.onPersonGone = onGone;
        this.onPersonBack = onBack;

        await this.init();

        if (!this.model) {
            console.error('Accountability: Model not loaded, cannot start session.');
            alert('Accountability Partner: AI Model failed to load. Please reload the page.');
            return;
        }

        try {
            // Clean up any existing stream first to avoid conflicts
            if (this.videoElement.srcObject) {
                console.log('Accountability: Cleaning up existing stream...');
                const tracks = this.videoElement.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                this.videoElement.srcObject = null;
                // Small delay to ensure cleanup completes
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Now request fresh camera access
            console.log('Accountability: Getting user media...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240 }
            });
            this.videoElement.srcObject = stream;

            // Wait for video to be ready BEFORE trying to play
            console.log('Accountability: Waiting for video metadata...');
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Video metadata timeout'));
                }, 5000);

                this.videoElement.onloadedmetadata = () => {
                    clearTimeout(timeout);
                    console.log('Accountability: Video metadata loaded');
                    resolve();
                };
            });

            // Now it's safe to play
            console.log('Accountability: Starting video playback...');
            await this.videoElement.play();

            this.isSessionActive = true;
            this.lastPersonDetectedTime = Date.now();
            this.isPersonGone = false;

            this.startDetectionLoop();
            console.log('Accountability: Session started successfully.');

        } catch (error) {
            console.error('Accountability: Error accessing webcam:', error);
            this.isSessionActive = false; // Reset state on failure

            // Only alert if it's a permission error or critical error
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                alert('Could not access webcam. Please allow camera permissions to use the Accountability Partner feature.');
            } else if (error.name === 'AbortError') {
                // Play was interrupted - this is often benign, just log it
                console.warn('Accountability: Video playback interrupted. This is usually harmless.');
            } else if (error.message && error.message.includes('timeout')) {
                console.warn('Accountability: Video initialization timeout.');
                alert('Accountability Partner: Camera took too long to initialize. Please try again.');
            } else {
                console.warn("Accountability: Webcam access error:", error);
                // Don't show alert for other errors, just log them
            }
        }
    }

    stopSession() {
        this.isSessionActive = false;

        if (this.detectionInterval) {
            clearTimeout(this.detectionInterval);
            this.detectionInterval = null;
        }

        // Stop video stream
        if (this.videoElement && this.videoElement.srcObject) {
            const tracks = this.videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }

        console.log('Accountability session stopped.');
    }

    startDetectionLoop() {
        if (this.detectionInterval) clearTimeout(this.detectionInterval);

        console.log('Accountability: Starting detection loop...');
        // Run first check immediately (0ms delay)
        this.detectionInterval = setTimeout(async function detectStep() {
            if (!this.isSessionActive || !this.model || !this.videoElement) {
                return;
            }

            try {
                // Lower threshold to 0.3 for better detection, limit max boxes to 1 for performance
                const predictions = await this.model.detect(this.videoElement, 1, 0.3);
                const person = predictions.find(p => p.class === 'person');

                // Always log for debugging
                console.log('Accountability Check:', person ? `Person detected (${Math.round(person.score * 100)}%)` : 'No person detected', 'Time since last seen:', Math.round((Date.now() - this.lastPersonDetectedTime) / 1000) + 's');

                if (person) {
                    if (this.isPersonGone) {
                        console.log('Accountability: Person found! Score:', person.score);
                    }
                    this.lastPersonDetectedTime = Date.now();
                    if (this.isPersonGone) {
                        this.isPersonGone = false;
                        console.log('Accountability: Triggering onPersonBack');
                        if (this.onPersonBack) this.onPersonBack();
                    }
                } else {
                    const timeSinceLastSeen = Date.now() - this.lastPersonDetectedTime;
                    if (timeSinceLastSeen > this.goneThreshold && !this.isPersonGone) {
                        this.isPersonGone = true;
                        console.log('Accountability: Person gone for ' + timeSinceLastSeen + 'ms. Triggering onPersonGone');
                        if (this.onPersonGone) this.onPersonGone();
                    }
                }
            } catch (error) {
                console.error('Accountability: Detection error:', error);
            }

            // Schedule next check
            if (this.isSessionActive) {
                this.detectionInterval = setTimeout(detectStep.bind(this), this.checkIntervalMs);
            }
        }.bind(this), 0); // Start immediately with 0ms delay
    }
}

// Export instance
window.accountabilityPartner = new AccountabilityPartner();
